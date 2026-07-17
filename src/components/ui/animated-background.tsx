"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export const AnimatedBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#FDFCFB]">
      {/* Dynamic blob following mouse with delay */}
      <motion.div
        className="absolute top-0 left-0 w-[40vw] h-[40vw] rounded-full bg-brand-300/20 blur-[120px]"
        animate={{
          x: typeof window !== 'undefined' ? mousePosition.x - window.innerWidth / 4 : 0,
          y: typeof window !== 'undefined' ? mousePosition.y - window.innerHeight / 4 : 0,
        }}
        transition={{ type: "tween", ease: "backOut", duration: 2 }}
      />

      {/* Floating Orbs */}
      <motion.div
        className="absolute top-[10%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-brand-100/40 blur-[150px]"
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -100, 50, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-200/30 blur-[150px]"
        animate={{
          x: [0, -100, 50, 0],
          y: [0, 100, -50, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Grid overlay for texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    </div>
  );
};

export const FloatingIcons = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden -z-1">
      {/* Icon 1 */}
      <motion.div
        className="absolute top-[20%] left-[10%] p-4 bg-white rounded-2xl shadow-xl shadow-brand-500/10 border border-stone-100"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </div>
      </motion.div>

      {/* Icon 2 */}
      <motion.div
        className="absolute top-[60%] left-[5%] p-3 bg-white rounded-xl shadow-lg shadow-indigo-500/10 border border-stone-100"
        animate={{
          y: [0, 30, 0],
          x: [0, 10, 0],
          rotate: [0, -10, 10, 0],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
      </motion.div>

      {/* Icon 3 */}
      <motion.div
        className="absolute top-[15%] right-[10%] p-4 bg-white rounded-2xl shadow-xl shadow-amber-500/10 border border-stone-100"
        animate={{
          y: [0, 25, 0],
          rotate: [0, 15, -5, 0],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
        </div>
      </motion.div>
    </div>
  );
};
