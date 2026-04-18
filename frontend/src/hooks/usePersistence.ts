"use client";

import { useState, useEffect } from "react";

/**
 * usePersistence Hook
 * 
 * Synchronizes a state object with a specific localStorage key.
 * 
 * @param key The localStorage key to use
 * @param initialValue The default value if nothing is found in storage
 * @returns [state, setState, isLoaded]
 */
export function usePersistence<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(parsed);
      } catch (e) {
        console.error(`Error parsing persistence key "${key}":`, e);
      }
    }
    setIsLoaded(true);
  }, [key]);

  // Save to storage on change
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state, isLoaded]);

  return [state, setState, isLoaded];
}
