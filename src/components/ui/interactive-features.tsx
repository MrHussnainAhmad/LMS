"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, BookOpen, Shield, BarChart3, CheckCircle2 } from "lucide-react";

const features = [
  {
    id: "admin",
    title: "Administration",
    icon: Shield,
    description: "Streamline admissions, fee collection, and record keeping with automated workflows.",
    benefits: ["One-click fee vouchers", "Automated roll number generation", "Campus management"],
    color: "bg-blue-500",
    visual: (
      <div className="w-full h-full bg-slate-900 rounded-xl p-4 flex flex-col gap-3 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[40px] rounded-full"></div>
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <div className="h-4 w-24 bg-white/10 rounded ml-2"></div>
        </div>
        <div className="flex-1 flex gap-3 mt-2">
          <div className="w-1/3 h-full bg-white/5 rounded-lg p-3 space-y-3">
            <div className="h-2 w-full bg-white/10 rounded"></div>
            <div className="h-2 w-3/4 bg-white/10 rounded"></div>
            <div className="h-2 w-5/6 bg-white/10 rounded"></div>
            <div className="h-2 w-full bg-white/20 rounded mt-6"></div>
          </div>
          <div className="w-2/3 h-full bg-white/5 rounded-lg p-3 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-32 bg-white/20 rounded"></div>
              <div className="h-6 w-16 bg-blue-500/50 rounded-full"></div>
            </div>
            <div className="flex-1 border border-white/10 rounded-lg p-3 space-y-2">
               {[1,2,3].map(i => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.2 }}
                   className="h-8 w-full bg-white/5 rounded flex items-center px-2 gap-2"
                 >
                   <div className="w-4 h-4 rounded-full bg-white/20"></div>
                   <div className="h-2 w-1/2 bg-white/20 rounded"></div>
                 </motion.div>
               ))}
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "academics",
    title: "Academics",
    icon: BookOpen,
    description: "Empower teachers with smart grading, attendance tracking, and dynamic timetables.",
    benefits: ["Auto-grading for MCQs", "Real-time attendance logs", "Syllabus tracking"],
    color: "bg-brand-500",
    visual: (
      <div className="w-full h-full bg-white rounded-xl p-5 shadow-2xl relative overflow-hidden border border-stone-100 flex flex-col">
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-brand-500/10 blur-[50px] rounded-full"></div>
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-1">
            <div className="h-5 w-40 bg-stone-800 rounded"></div>
            <div className="h-3 w-24 bg-stone-300 rounded"></div>
          </div>
          <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center">
            <div className="h-5 w-5 bg-brand-500 rounded-sm"></div>
          </div>
        </div>
        <div className="space-y-4 flex-1">
          {[85, 92, 78].map((score, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15 + 0.2 }}
              className="w-full p-3 rounded-lg border border-stone-100 bg-stone-50 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-stone-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-stone-700 rounded"></div>
                <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 1, delay: i * 0.2 + 0.5 }}
                    className="h-full bg-brand-500"
                  ></motion.div>
                </div>
              </div>
              <div className="font-bold text-stone-700">{score}%</div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  },
  {
    id: "communication",
    title: "Communication",
    icon: Users,
    description: "Keep parents, students, and staff aligned with instant announcements and app notifications.",
    benefits: ["Push notifications", "Targeted announcements", "Parent portal"],
    color: "bg-indigo-500",
    visual: (
      <div className="w-full h-full bg-indigo-50/50 rounded-xl p-6 shadow-2xl relative overflow-hidden border border-indigo-100 flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 to-transparent"></div>
        
        <div className="relative z-10 w-full max-w-[240px] space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-2xl rounded-bl-sm shadow-sm border border-stone-100"
          >
            <div className="h-2 w-1/3 bg-stone-200 rounded mb-2"></div>
            <div className="h-3 w-full bg-stone-700 rounded mb-1"></div>
            <div className="h-3 w-5/6 bg-stone-700 rounded"></div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-indigo-600 p-4 rounded-2xl rounded-br-sm shadow-sm ml-auto text-white"
          >
            <div className="h-2 w-1/4 bg-indigo-300 rounded mb-2 ml-auto"></div>
            <div className="h-3 w-full bg-white rounded mb-1"></div>
            <div className="h-3 w-2/3 bg-white rounded ml-auto"></div>
          </motion.div>
          
          <motion.div 
             initial={{ scale: 0 }}
             animate={{ scale: 1 }}
             transition={{ type: "spring", delay: 0.8 }}
             className="absolute -right-4 top-1/2 bg-white rounded-full p-2 shadow-lg border border-stone-100"
          >
             <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
             </div>
          </motion.div>
        </div>
      </div>
    )
  }
];

export const InteractiveFeatures = () => {
  const [activeTab, setActiveTab] = useState(features[0].id);
  const activeFeature = features.find(f => f.id === activeTab) || features[0];

  return (
    <section className="w-full py-24 px-6 md:px-12 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-stone-900 mb-4 tracking-tight">Built for human workflows</h2>
        <p className="text-lg text-stone-600 max-w-2xl mx-auto">See how Nisaab360 transforms complex daily tasks into simple, elegant experiences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Side: Tabs */}
        <div className="flex flex-col gap-4">
          {features.map((feature) => {
            const isActive = activeTab === feature.id;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                className={`text-left p-6 rounded-3xl transition-all duration-300 relative overflow-hidden group ${
                  isActive 
                    ? 'bg-white shadow-xl shadow-stone-200/50 border-transparent ring-1 ring-stone-200' 
                    : 'bg-transparent border border-transparent hover:bg-stone-50'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-tab-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-500 rounded-r-full"
                  />
                )}
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-3 rounded-2xl transition-colors duration-300 ${isActive ? 'bg-brand-50 text-brand-600' : 'bg-stone-100 text-stone-500 group-hover:bg-stone-200 group-hover:text-stone-700'}`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold font-display mb-2 transition-colors ${isActive ? 'text-stone-900' : 'text-stone-600 group-hover:text-stone-900'}`}>
                      {feature.title}
                    </h3>
                    <p className={`text-stone-500 mb-4 transition-all duration-300 ${isActive ? 'h-auto opacity-100' : 'h-0 opacity-0 overflow-hidden m-0 p-0'}`}>
                      {feature.description}
                    </p>
                    
                    <AnimatePresence>
                      {isActive && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 mt-4"
                        >
                          {feature.benefits.map((benefit, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-brand-500" />
                              {benefit}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Side: Interactive Visual */}
        <div className="relative h-[400px] md:h-[500px] w-full bg-stone-100 rounded-[2.5rem] p-4 md:p-8 overflow-hidden flex items-center justify-center">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-300 via-transparent to-transparent"></div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full h-full relative z-10"
            >
              {activeFeature.visual}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
