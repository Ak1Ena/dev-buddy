'use client';

import React from 'react';
import { LessonLayout } from '@/components/lessons/LessonLayout';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { InteractiveAnimation } from '@/components/animations/InteractiveAnimation';

export default function LessonPage() {
  return (
    <LessonLayout title="Introduction to React state" progress={30}>
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Main Content Area */}
        <div className="flex-1 bg-white rounded-xl shadow-md p-8 overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">What is State?</h2>
          
          <div className="prose max-w-none text-gray-600">
            <p>
              In React, <strong>state</strong> is an object that stores data relevant to a component. 
              When the state changes, the component responds by re-rendering to reflect the new data.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-2">The useState Hook</h3>
            <p>
              The most common way to manage state in functional components is using the <code>useState</code> hook.
            </p>
            
            <div className="bg-gray-800 text-green-400 p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto">
              <pre>
{`import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}`}
              </pre>
            </div>
            
            <InteractiveAnimation />
            
            <p>
              Try to explain how the <code>setCount</code> function works to the devBuddy teacher in the chat!
            </p>
          </div>
        </div>

        {/* Right Sidebar - Chat */}
        <div className="w-full lg:w-96 flex-shrink-0 h-[500px] lg:h-full">
          <ChatInterface />
        </div>
      </div>
    </LessonLayout>
  );
}
