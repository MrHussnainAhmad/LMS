"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Users, School, FileText } from "lucide-react";

const Counter = ({ value, label, icon: Icon, delay }: { value: number, label: string, icon: any, delay: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    
    // Animate count
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smoother finish
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setCount(Math.floor(easeOutQuart * value));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isInView, value]);

  // Format with commas, or a + if it's large
  const displayValue = count > 1000 ? `${(count / 1000).toFixed(1).replace('.0', '')}k+` : count;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay }}
      className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-lg border border-stone-100 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-500"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-7 w-7" />
      </div>
      <div className="text-4xl md:text-5xl font-display font-extrabold text-stone-900 tracking-tight mb-2">
        {displayValue}
      </div>
      <div className="text-stone-500 font-medium uppercase tracking-widest text-sm">
        {label}
      </div>
    </motion.div>
  );
};

export const LiveStats = ({ stats }: { stats: { institutions: number, students: number, tests: number } }) => {
  return (
    <section className="w-full py-20 bg-stone-50 border-y border-stone-200 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-200/20 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-200/20 blur-[100px] rounded-full"></div>
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-16">
          <motion.p 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600 mb-3"
          >
            Live Platform Usage
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-display font-bold text-stone-900"
          >
            Powering education globally
          </motion.h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
          <Counter value={stats.institutions} label="Active Institutions" icon={School} delay={0.2} />
          <Counter value={stats.students} label="Students Enrolled" icon={Users} delay={0.3} />
          <Counter value={stats.tests} label="Exams Conducted" icon={FileText} delay={0.4} />
        </div>
      </div>
    </section>
  );
};
