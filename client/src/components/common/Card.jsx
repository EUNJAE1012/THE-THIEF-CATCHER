import React from 'react';
import { motion } from 'framer-motion';
import './Card.css';

const SUIT_SYMBOLS = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  joker: '🃏'
};

const SUIT_COLORS = {
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  joker: 'special'
};

const Card = ({ 
  card, 
  isBack = false, 
  size = 'medium', 
  isClickable = false,
  onClick 
}) => {
  const sizeClasses = {
    tiny: 'card-tiny',
    small: 'card-small',
    medium: 'card-medium',
    large: 'card-large'
  };

  if (isBack) {
    return (
      <div 
        className={`card card-back ${sizeClasses[size]} ${isClickable ? 'clickable' : ''}`}
        onClick={isClickable ? onClick : undefined}
      >
        <div className="card-back-pattern">
          <div className="pattern-inner">
            <span className="pattern-symbol">♠</span>
            <span className="pattern-symbol">♥</span>
            <span className="pattern-symbol">♦</span>
            <span className="pattern-symbol">♣</span>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const { suit, value, isJoker } = card;
  const symbol = SUIT_SYMBOLS[suit];
  const colorClass = SUIT_COLORS[suit];

  if (isJoker) {
    return (
      <div className={`card card-joker ${sizeClasses[size]}`}>
        <div className="card-content">
          <span className="joker-icon">🃏</span>
          <span className="joker-text">J</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`card card-front ${sizeClasses[size]} ${colorClass}`}>
      <div className="card-corner top-left">
        <span className="card-value">{value}</span>
        <span className="card-suit">{symbol}</span>
      </div>
      <div className="card-center">
        <span className="card-suit-large">{symbol}</span>
      </div>
      <div className="card-corner bottom-right">
        <span className="card-value">{value}</span>
        <span className="card-suit">{symbol}</span>
      </div>
    </div>
  );
};

export default Card;