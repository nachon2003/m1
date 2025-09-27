import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
    wins: '#4CAF50',   // Green for wins, matches existing styles
    losses: '#F44336', // Red for losses
};

const WinLossPieChart = ({ wins, losses }) => {
    const data = [
        { name: 'Wins', value: wins },
        { name: 'Losses', value: losses },
    ];

    // If there's no data, display a message instead of an empty chart.
    if (wins === 0 && losses === 0) {
        return (
            <div className="stats-chart-container">
                No trade data available to generate a chart.
            </div>
        );
    }

    return (
        // The container styles are handled by the CSS class for better maintainability.
        <div className="stats-chart-container">
            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        // A custom label that only shows for slices larger than 5% to avoid clutter.
                        label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : null)}
                    >
                        {data.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.name === 'Wins' ? COLORS.wins : COLORS.losses} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#353a47', borderColor: '#444' }} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default WinLossPieChart;