import { useEffect, useState } from 'react';
import { Box, Button, Heading, HStack, Text } from '@chakra-ui/react';
import WeekPlanner from './components/WeekPlanner';

function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function App() {
    const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
    const [entries, setEntries] = useState([]);
    const [mealSuggestions, setMealSuggestions] = useState([]);
    const [weather, setWeather] = useState({});

    useEffect(() => {
        fetch(`/api/menus/week?start=${toDateStr(weekStart)}`)
            .then(r => r.json())
            .then(setEntries)
            .catch(console.error);
    }, [weekStart]);

    useEffect(() => {
        fetch('/api/menus/meal-names')
            .then(r => r.json())
            .then(setMealSuggestions)
            .catch(console.error);
    }, []);

    useEffect(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return toDateStr(d);
        });
        Promise.all(
            days.map(date =>
                fetch(`/api/weather?date=${date}`)
                    .then(r => r.json())
                    .then(data => ({ date, data }))
                    .catch(() => ({ date, data: null }))
            )
        ).then(results => {
            const map = {};
            results.forEach(({ date, data }) => { map[date] = data; });
            setWeather(map);
        });
    }, [weekStart]);

    const shiftWeek = (days) => setWeekStart(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + days);
        return d;
    });

    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <Box maxW="560px" mx="auto" p={6}>
            <Heading as="h1" size="lg" mb={6}>Meal Planner</Heading>
            <HStack justify="space-between" mb={4}>
                <Button onClick={() => shiftWeek(-7)} size="sm" variant="outline">← Prev</Button>
                <Text fontWeight="semibold" fontSize="sm">{weekLabel}</Text>
                <Button onClick={() => shiftWeek(7)} size="sm" variant="outline">Next →</Button>
            </HStack>
            <WeekPlanner
                weekStart={weekStart}
                entries={entries}
                setEntries={setEntries}
                weather={weather}
                mealSuggestions={mealSuggestions}
                setMealSuggestions={setMealSuggestions}
                toDateStr={toDateStr}
            />
        </Box>
    );
}

export default App;
