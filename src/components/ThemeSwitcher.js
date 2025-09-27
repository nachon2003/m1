// src/components/ThemeSwitcher.js
import React from 'react';
import './ThemeSwitcher.css';

const ThemeSwitcher = ({ theme, toggleTheme }) => {
    const isDark = theme === 'dark';
    return (
        <div className="theme-switch-wrapper">
            <label className="theme-switch" htmlFor="theme-switch-checkbox">
                <input
                    type="checkbox"
                    id="theme-switch-checkbox"
                    onChange={toggleTheme}
                    checked={isDark}
                />
                <div className="slider round">
                    <span className="icon sun">☀️</span>
                    <span className="icon moon">🌙</span>
                </div>
            </label>
        </div>
    );
};

export default ThemeSwitcher;

