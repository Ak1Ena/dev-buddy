'use client';

import React from 'react';

interface LessonLayoutProps {
  children: React.ReactNode;
  title: string;
  progress: number;
}

export const LessonLayout: React.FC<LessonLayoutProps> = ({
  children,
  title,
  progress,
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full p-6">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-between">
          <button className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Previous
          </button>
          <button className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            Next Lesson
          </button>
        </div>
      </footer>
    </div>
  );
};
