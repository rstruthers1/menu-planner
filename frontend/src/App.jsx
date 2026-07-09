import { useEffect, useState } from 'react';
import {
    Box, Button, Heading, HStack, Input, Tab, TabList, TabPanel, TabPanels, Tabs, Text,
} from '@chakra-ui/react';
import WeekPlanner from './components/WeekPlanner';
import History from './components/History';
import MealLibrary from './components/MealLibrary';
import RecipeList from './components/RecipeList';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import { authFetch } from './utils/api';

function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getSundayOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
}

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    const [weekStart, setWeekStart] = useState(() => getSundayOfWeek(new Date()));
    const [historyKey, setHistoryKey] = useState(0);
    const [entries, setEntries] = useState([]);
    const [mealLibrary, setMealLibrary] = useState([]); // [{id, name, minTemp, maxTemp}]
    const [weather, setWeather] = useState({});

    // Validate stored token on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setAuthChecked(true); return; }
        authFetch('/api/auth/me')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(user => setCurrentUser(user))
            .catch(() => localStorage.removeItem('token'))
            .finally(() => setAuthChecked(true));
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        authFetch(`/api/menus/week?start=${toDateStr(weekStart)}`)
            .then(r => r.json())
            .then(setEntries)
            .catch(console.error);
    }, [weekStart, currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        authFetch('/api/meals')
            .then(r => r.json())
            .then(setMealLibrary)
            .catch(console.error);
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return toDateStr(d);
        });
        Promise.all(
            days.map(date =>
                authFetch(`/api/weather?date=${date}`)
                    .then(r => r.json())
                    .then(data => ({ date, data }))
                    .catch(() => ({ date, data: null }))
            )
        ).then(results => {
            const map = {};
            results.forEach(({ date, data }) => { map[date] = data; });
            setWeather(map);
        });
    }, [weekStart, currentUser]);

    const handleLogin = (token, user) => {
        localStorage.setItem('token', token);
        setCurrentUser(user);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setCurrentUser(null);
        setEntries([]);
        setMealLibrary([]);
        setWeather({});
    };

    const shiftWeek = (days) => setWeekStart(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + days);
        return d;
    });

    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (!authChecked) return null;
    if (!currentUser) return <Login onLogin={handleLogin} />;

    return (
        <Box maxW="640px" mx="auto" p={6}>
            <HStack justify="space-between" mb={6}>
                <Box>
                    <Heading as="h1" size="lg">Meal Planner</Heading>
                    {currentUser.householdName && (
                        <Text fontSize="xs" color="gray.400" mt="1px">{currentUser.householdName} household</Text>
                    )}
                </Box>
                <HStack spacing={3}>
                    <Text fontSize="sm" color="gray.500">{currentUser.name}</Text>
                    <Button size="xs" variant="ghost" colorScheme="gray" onClick={handleLogout}>Log out</Button>
                </HStack>
            </HStack>
            <Tabs onChange={(i) => { if (i === 1) setHistoryKey(k => k + 1); }}>
                <TabList mb={4}>
                    <Tab>Planner</Tab>
                    <Tab>History</Tab>
                    <Tab>Meal Library</Tab>
                    <Tab>Recipes</Tab>
                    {currentUser.admin && <Tab>Admin</Tab>}
                </TabList>
                <TabPanels>
                    <TabPanel p={0}>
                        <HStack justify="space-between" mb={2}>
                            <Button onClick={() => shiftWeek(-7)} size="sm" variant="outline">← Prev</Button>
                            <Text fontWeight="semibold" fontSize="sm">{weekLabel}</Text>
                            <Button onClick={() => shiftWeek(7)} size="sm" variant="outline">Next →</Button>
                        </HStack>
                        <HStack justify="flex-end" mb={4} spacing={2}>
                            <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="blue"
                                isDisabled={weekStart.toDateString() === getSundayOfWeek(new Date()).toDateString()}
                                onClick={() => setWeekStart(getSundayOfWeek(new Date()))}
                            >
                                Today
                            </Button>
                            <Input
                                type="date"
                                size="xs"
                                w="150px"
                                title="Jump to week containing this date"
                                onChange={e => {
                                    if (e.target.value)
                                        setWeekStart(getSundayOfWeek(new Date(e.target.value + 'T00:00:00')));
                                }}
                            />
                        </HStack>
                        <WeekPlanner
                            weekStart={weekStart}
                            entries={entries}
                            setEntries={setEntries}
                            weather={weather}
                            mealLibrary={mealLibrary}
                            setMealLibrary={setMealLibrary}
                            toDateStr={toDateStr}
                        />
                    </TabPanel>
                    <TabPanel p={0} pt={2}>
                        <History key={historyKey} />
                    </TabPanel>
                    <TabPanel p={0} pt={2}>
                        <MealLibrary onMealSaved={(saved) => {
                            const meal = {
                                id: saved.id, name: saved.name,
                                recipeLink: saved.recipeLink ?? null, notes: saved.notes ?? null,
                                minTemp: saved.minTemp ?? null, maxTemp: saved.maxTemp ?? null,
                                seasons: saved.seasons || [], sides: saved.sides || [],
                            };
                            setMealLibrary(prev => {
                                const exists = prev.some(m => m.id === saved.id);
                                const next = exists ? prev.map(m => m.id === saved.id ? meal : m) : [...prev, meal];
                                return next.sort((a, b) => a.name.localeCompare(b.name));
                            });
                        }} />
                    </TabPanel>
                    <TabPanel p={0} pt={2}>
                        <RecipeList mealLibrary={mealLibrary} />
                    </TabPanel>
                    {currentUser.admin && (
                        <TabPanel p={0} pt={2}>
                            <AdminPanel />
                        </TabPanel>
                    )}
                </TabPanels>
            </Tabs>
        </Box>
    );
}

export default App;
