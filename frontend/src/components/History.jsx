import { useEffect, useState } from 'react';
import {
    Box, Link, Table, Tbody, Td, Text, Th, Thead, Tr,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

function weatherIcon(condition) {
    if (!condition) return '';
    const c = condition.toLowerCase();
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
    if (c.includes('fog')) return '🌫️';
    if (c.includes('overcast')) return '☁️';
    if (c.includes('partly') || c.includes('mainly clear')) return '⛅';
    if (c.includes('clear')) return '☀️';
    return '🌤️';
}

function History() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authFetch('/api/history')
            .then(r => r.json())
            .then(data => { setEntries(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <Text color="gray.400" fontSize="sm">Loading…</Text>;
    if (entries.length === 0) return <Text color="gray.400" fontSize="sm">No past meals recorded yet.</Text>;

    return (
        <Box overflowX="auto">
            <Table size="sm" variant="simple">
                <Thead>
                    <Tr>
                        <Th>Date</Th>
                        <Th>Meal</Th>
                        <Th>Weather</Th>
                        <Th>Recipe</Th>
                        <Th>Notes</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {entries.map(e => (
                        <Tr key={e.id}>
                            <Td whiteSpace="nowrap">
                                <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                                    {e.dayOfWeek?.slice(0, 3)}
                                </Text>
                                <Text fontSize="xs" color="gray.400">
                                    {e.mealDate
                                        ? new Date(e.mealDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : ''}
                                </Text>
                            </Td>
                            <Td fontSize="sm">{e.mealName}</Td>
                            <Td whiteSpace="nowrap">
                                {e.condition ? (
                                    <Text fontSize="sm" color="gray.600">
                                        {weatherIcon(e.condition)} {e.highTempF}°/{e.lowTempF}°
                                    </Text>
                                ) : (
                                    <Text fontSize="sm" color="gray.200">—</Text>
                                )}
                            </Td>
                            <Td>
                                {e.recipeLink
                                    ? <Link href={e.recipeLink} isExternal color="blue.400" fontSize="sm">Link</Link>
                                    : null}
                            </Td>
                            <Td fontSize="sm" color="gray.600" maxW="200px">
                                <Text noOfLines={2}>{e.notes}</Text>
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </Box>
    );
}

export default History;
