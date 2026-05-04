import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { SubjectSelection } from './components/SubjectSelection';
import { Assessment } from './components/Assessment';
import { LearningPathMap } from './components/LearningPathMap';
import { LessonPlayer } from './components/LessonPlayer';

type AppState = 'SELECT_SUBJECT' | 'ASSESSMENT' | 'LOADING' | 'MAP' | 'LESSON';

const api = axios.create({
  baseURL: '/api',
});

export default function App() {
  const [state, setState] = useState<AppState>('SELECT_SUBJECT');
  const [subject, setSubject] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [activeLessonContent, setActiveLessonContent] = useState<any>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const savedUserId = localStorage.getItem('devbuddy_user_id');
    if (savedUserId) {
      setUserId(savedUserId);
    } else {
      const newId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('devbuddy_user_id', newId);
      setUserId(newId);
    }
  }, []);

  const handleSubjectSelect = async (selectedSubject: string) => {
    setSubject(selectedSubject);
    try {
      await api.post('/setup-assessment', { subject: selectedSubject, user_id: userId });
      setState('ASSESSMENT');
    } catch (error) {
      console.error('Error setting up assessment:', error);
      alert('Failed to connect to the brain. Please check if backend is running.');
    }
  };

  const handleAssessmentComplete = async (answers: string[]) => {
    setState('LOADING');
    try {
      const response = await api.post('/assessment/submit', {
        user_id: userId,
        subject: subject,
        answers: answers
      });
      
      const data = response.data;
      setUserProfile({
        userId: userId,
        level: data.level,
        path: data.path.map((title: string) => ({
          title,
          isCompleted: false,
          isDeepDive: false
        }))
      });
      setState('MAP');
    } catch (error) {
      console.error('Assessment submission error:', error);
      setState('SELECT_SUBJECT');
    }
  };

  const handleTopicSelect = async (index: number) => {
    setState('LOADING');
    try {
      const response = await api.get(`/lesson/next/${userId}`);
      const data = response.data;
      
      setActiveLessonContent({
        topic: data.topic,
        content: data.content.content,
        code_examples: data.content.code_examples,
        animation_html: data.content.animation_html
      });
      setCurrentLessonIndex(index);
      setState('LESSON');
    } catch (error) {
      console.error('Lesson fetch error:', error);
      setState('MAP');
    }
  };

  const handlePathUpdate = (newPath: string[]) => {
    setUserProfile(prev => ({
      ...prev,
      path: newPath.map((title: string) => ({
        title,
        isCompleted: false,
        isDeepDive: title.startsWith('Deep Dive:')
      }))
    }));
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-mono">
      <AnimatePresence mode="wait">
        {state === 'SELECT_SUBJECT' && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SubjectSelection onSelect={handleSubjectSelect} />
          </motion.div>
        )}

        {state === 'ASSESSMENT' && (
          <motion.div key="assess" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Assessment subject={subject} onComplete={handleAssessmentComplete} />
          </motion.div>
        )}

        {state === 'LOADING' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen">
            <Loader2 className="animate-spin text-cyan-400 mb-4" size={48} />
            <h2 className="text-xl font-medium text-white">Orchestrating your experience...</h2>
            <p className="text-slate-400">Consulting Agents for the perfect path</p>
          </motion.div>
        )}

        {state === 'MAP' && (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold text-white mb-2">Your Learning Path</h1>
              <p className="text-slate-400">Master {subject} step by step</p>
            </div>
            <LearningPathMap 
              path={userProfile.path} 
              currentIndex={currentLessonIndex} 
              onTopicSelect={handleTopicSelect} 
            />
          </motion.div>
        )}

        {state === 'LESSON' && (
          <motion.div key="lesson" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LessonPlayer 
              content={activeLessonContent} 
              onBack={() => setState('MAP')} 
              userId={userId}
              onPathUpdate={handlePathUpdate}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
