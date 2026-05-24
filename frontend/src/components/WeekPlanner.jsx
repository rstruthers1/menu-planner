import DayRow from './DayRow';

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

    return (
        <div>
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
                />
            ))}
        </div>
    );
}

export default WeekPlanner;
