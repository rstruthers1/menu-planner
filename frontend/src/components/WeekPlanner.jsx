import DayRow from './DayRow';
import WeekHelper from './WeekHelper';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function WeekPlanner({ weekStart, entries, setEntries, weather, mealSuggestions, setMealSuggestions, toDateStr }) {
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { date: d, dateStr: toDateStr(d), dayName: DAY_NAMES[i] };
    });

    const entriesByDate = {};
    entries.forEach(e => { entriesByDate[e.mealDate] = e; });

    const handleSave = (dateStr, dayName, mealName, weatherData) => {
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
            weather: weatherData?.condition || '',
            highTempF: weatherData?.high ?? null,
            lowTempF: weatherData?.low ?? null,
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

    const handleSuggestions = (suggestions) => {
        Object.entries(suggestions).forEach(([dateStr, mealName]) => {
            const day = days.find(d => d.dateStr === dateStr);
            if (day) handleSave(dateStr, day.dayName, mealName, weather[dateStr]);
        });
    };

    return (
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
                    onAskAI={(dateStr, dayName, prompt) => {
                        const existingMeals = {};
                        entries.forEach(e => { if (e.mealName) existingMeals[e.mealDate] = e.mealName; });
                        const weatherMap = {};
                        if (weather[dateStr]) weatherMap[dateStr] = weather[dateStr];
                        fetch('/api/suggest-meals', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                weekStart: toDateStr(weekStart),
                                prompt,
                                weather: weatherMap,
                                existingMeals,
                                targetDate: dateStr,
                            }),
                        })
                            .then(r => r.json())
                            .then(suggestions => {
                                const meal = suggestions[dateStr];
                                if (meal) handleSave(dateStr, dayName, meal, weather[dateStr]);
                            })
                            .catch(console.error);
                    }}
                />
            ))}
        </div>
    );
}

export default WeekPlanner;
