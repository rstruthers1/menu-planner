import { useState } from 'react';
import AiChatModal from './AiChatModal';
import DayRow from './DayRow';
import MealDetailModal from './MealDetailModal';
import WeekHelper from './WeekHelper';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function WeekPlanner({ weekStart, entries, setEntries, weather, mealSuggestions, setMealSuggestions, toDateStr }) {
    const [detailDay, setDetailDay] = useState(null);
    const [aiChatDay, setAiChatDay] = useState(null);

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { date: d, dateStr: toDateStr(d), dayName: DAY_NAMES[i] };
    });

    const entriesByDate = {};
    entries.forEach(e => { entriesByDate[e.mealDate] = e; });

    const handleSave = (dateStr, dayName, mealName) => {
        const existing = entriesByDate[dateStr];

        if (!mealName.trim()) {
            if (existing) {
                fetch(`/api/menus/${existing.id}`, { method: 'DELETE' })
                    .then(() => setEntries(prev => prev.filter(e => e.mealDate !== dateStr)))
                    .catch(console.error);
            }
            return;
        }

        const body = {
            mealDate: dateStr,
            dayOfWeek: dayName,
            mealName: mealName.trim(),
            confirmed: existing?.confirmed ?? false,
            leftover: existing?.leftover ?? false,
            leftoverFromDate: existing?.leftoverFromDate ?? null,
        };

        const addSuggestion = (name) => {
            if (!mealSuggestions.includes(name)) {
                setMealSuggestions(prev => [...prev, name].sort());
            }
        };

        if (existing) {
            fetch(`/api/menus/${existing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
                .then(r => r.json())
                .then(updated => {
                    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
                    addSuggestion(updated.mealName);
                })
                .catch(console.error);
        } else {
            fetch('/api/menus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
                .then(r => r.json())
                .then(created => {
                    setEntries(prev => [...prev, created]);
                    addSuggestion(created.mealName);
                })
                .catch(console.error);
        }
    };

    const handleToggleConfirmed = (entry) => {
        fetch(`/api/menus/${entry.id}/confirmed`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmed: !entry.confirmed }),
        })
            .then(r => r.json())
            .then(updated => setEntries(prev => prev.map(e => e.id === updated.id ? updated : e)))
            .catch(console.error);
    };

    const handleSuggestions = (suggestions) => {
        Object.entries(suggestions).forEach(([dateStr, mealName]) => {
            const day = days.find(d => d.dateStr === dateStr);
            if (day) handleSave(dateStr, day.dayName, mealName);
        });
    };

    return (
        <>
        <div>
            <WeekHelper
                weekStart={weekStart}
                weather={weather}
                entries={entries}
                toDateStr={toDateStr}
                onSuggestions={handleSuggestions}
            />
            {days.map(({ date, dateStr, dayName }) => (
                <DayRow
                    key={dateStr}
                    date={date}
                    dateStr={dateStr}
                    dayName={dayName}
                    entry={entriesByDate[dateStr]}
                    weather={weather[dateStr]}
                    mealSuggestions={mealSuggestions}
                    onSave={handleSave}
                    onToggleConfirmed={handleToggleConfirmed}
                    onOpenDetail={(mode) => setDetailDay({ dateStr, dayName, entry: entriesByDate[dateStr], mode })}
                    onOpenAiChat={() => {
                        const existingMeals = {};
                        entries.forEach(e => { if (e.mealName) existingMeals[e.mealDate] = e.mealName; });
                        setAiChatDay({ dateStr, dayName, weather: weather[dateStr], existingMeals });
                    }}
                />
            ))}
        </div>
        {aiChatDay && (
            <AiChatModal
                isOpen={!!aiChatDay}
                onClose={() => setAiChatDay(null)}
                dateStr={aiChatDay.dateStr}
                dayName={aiChatDay.dayName}
                weather={aiChatDay.weather}
                existingMeals={aiChatDay.existingMeals}
                mealLibrary={mealSuggestions}
                weekStart={toDateStr(weekStart)}
                onSelect={(mealName) => {
                    handleSave(aiChatDay.dateStr, aiChatDay.dayName, mealName);
                    if (!mealSuggestions.includes(mealName)) {
                        setMealSuggestions(prev => [...prev, mealName].sort());
                    }
                }}
            />
        )}
        {detailDay && (
            <MealDetailModal
                isOpen={!!detailDay}
                onClose={() => setDetailDay(null)}
                dateStr={detailDay.dateStr}
                dayName={detailDay.dayName}
                entry={detailDay.entry}
                mode={detailDay.mode}
                onSaved={(saved) => {
                    setEntries(prev => {
                        const exists = prev.find(e => e.id === saved.id);
                        return exists
                            ? prev.map(e => e.id === saved.id ? saved : e)
                            : [...prev, saved];
                    });
                    if (saved.mealName && !mealSuggestions.includes(saved.mealName)) {
                        setMealSuggestions(prev => [...prev, saved.mealName].sort());
                    }
                }}
            />
        )}
        </>
    );
}

export default WeekPlanner;
