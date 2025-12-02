import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing background music
 * @param {string} musicSrc - Path to the music file
 * @param {boolean} shouldPlay - Whether music should be playing
 * @param {boolean} loop - Whether music should loop
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export const useBackgroundMusic = (musicSrc, shouldPlay = false, loop = true, volume = 0.3) => {
  const audioRef = useRef(null);

  useEffect(() => {
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio(musicSrc);
      audioRef.current.loop = loop;
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    // Update audio properties
    audio.loop = loop;
    audio.volume = volume;

    // Play or pause based on shouldPlay
    if (shouldPlay) {
      // Reset to beginning when switching tracks
      if (audio.src !== window.location.origin + musicSrc) {
        audio.src = musicSrc;
        audio.load();
      }

      const playPromise = audio.play();

      // Handle autoplay restrictions
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Audio playback failed:', error);
          // User interaction required for autoplay
        });
      }
    } else {
      audio.pause();
    }

    // Cleanup function
    return () => {
      if (audio && !shouldPlay) {
        audio.pause();
      }
    };
  }, [musicSrc, shouldPlay, loop, volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return audioRef;
};
