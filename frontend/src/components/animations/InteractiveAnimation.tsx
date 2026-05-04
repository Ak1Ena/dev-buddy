'use client';

import React, { useState } from 'react';

export const InteractiveAnimation = () => {
  const [step, setStep] = useState(0);

  const steps = [
    { title: "Initial State", description: "The component renders with the initial state value." },
    { title: "User Action", description: "The user interacts with the component (e.g., clicks a button)." },
    { title: "State Update", description: "The state updater function (e.g., setCount) is called." },
    { title: "Re-render", description: "React re-renders the component with the new state." },
  ];

  return (
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 my-6">
      <h4 className="text-lg font-bold text-gray-800 mb-4">Interactive Animation: React State Cycle</h4>
      
      <div className="flex justify-between items-center mb-8 relative">
        {/* Connection Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-300 -z-10 transform -translate-y-1/2"></div>
        
        {/* Steps */}
        {steps.map((s, idx) => (
          <div 
            key={idx} 
            className={`flex flex-col items-center cursor-pointer`}
            onClick={() => setStep(idx)}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-all ${
              idx <= step ? 'bg-blue-600 text-white shadow-lg scale-110' : 'bg-gray-200 text-gray-500'
            }`}>
              {idx + 1}
            </div>
            <span className={`text-sm font-medium ${idx <= step ? 'text-blue-800' : 'text-gray-500'}`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm text-center min-h-[120px] flex items-center justify-center border-l-4 border-blue-500">
        <p className="text-gray-700 text-lg">
          {steps[step].description}
        </p>
      </div>

      <div className="flex justify-center mt-6 space-x-4">
        <button 
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
        >
          Back
        </button>
        <button 
          onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
          disabled={step === steps.length - 1}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Forward
        </button>
      </div>
    </div>
  );
};
