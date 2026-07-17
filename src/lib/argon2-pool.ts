import { Worker } from 'worker_threads';

const workerCode = `
const { parentPort } = require('worker_threads');
const argon2 = require('@node-rs/argon2');

parentPort.on('message', async (task) => {
  try {
    if (task.type === 'hash') {
      const result = await argon2.hash(task.password);
      parentPort.postMessage({ id: task.id, result });
    } else if (task.type === 'verify') {
      const result = await argon2.verify(task.hash, task.password);
      parentPort.postMessage({ id: task.id, result });
    }
  } catch (err) {
    parentPort.postMessage({ id: task.id, error: err.message });
  }
});
`;

// Simple round-robin worker pool
const numWorkers = 2;
const workers: Worker[] = [];
let nextWorkerIndex = 0;

let msgId = 0;
const callbacks = new Map<number, { resolve: Function, reject: Function }>();
const MAX_QUEUE_SIZE = 100;

function initWorkers() {
  if (workers.length === 0) {
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(workerCode, { eval: true });
      worker.on('message', (msg) => {
        const cb = callbacks.get(msg.id);
        if (cb) {
          callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error));
          else cb.resolve(msg.result);
        }
      });
      worker.on('error', (err) => {
        console.error('argon2 worker error:', err);
      });
      workers.push(worker);
    }
  }
}

function getWorker() {
  initWorkers();
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % numWorkers;
  return worker;
}

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (callbacks.size >= MAX_QUEUE_SIZE) return reject(new Error('Argon2 worker queue full'));
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    getWorker().postMessage({ id, type: 'hash', password });
  });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (callbacks.size >= MAX_QUEUE_SIZE) return reject(new Error('Argon2 worker queue full'));
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    getWorker().postMessage({ id, type: 'verify', hash, password });
  });
}
