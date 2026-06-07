import { useEffect, useRef, useState } from 'react';
import {
    Box, Button, HStack, Input, Link, Table, Tbody, Td, Text, Th, Thead, Tr,
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

const PAGE_SIZE = 10;

function History() {
    const [entries, setEntries] = useState([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [jumpDate, setJumpDate] = useState('');
    const [jumpError, setJumpError] = useState('');
    const jumpInputRef = useRef(null);

    function fetchPage(p) {
        setLoading(true);
        authFetch(`/api/history?page=${p}&size=${PAGE_SIZE}`)
            .then(r => r.json())
            .then(data => {
                setEntries(data.entries ?? []);
                setPage(data.page ?? 0);
                setTotalPages(data.totalPages ?? 0);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }

    useEffect(() => { fetchPage(0); }, []);

    function handleJump() {
        if (!jumpDate) return;
        setJumpError('');
        authFetch(`/api/history/page-for-date?date=${jumpDate}&size=${PAGE_SIZE}`)
            .then(r => r.json())
            .then(data => {
                const targetPage = data.page ?? 0;
                fetchPage(targetPage);
            })
            .catch(() => setJumpError('Could not jump to that date.'));
    }

    if (loading && entries.length === 0) return <Text color="gray.400" fontSize="sm">Loading…</Text>;

    return (
        <Box>
            <HStack mb={3} spacing={2} align="flex-start">
                <Box>
                    <HStack spacing={1}>
                        <Input
                            ref={jumpInputRef}
                            type="date"
                            size="sm"
                            w="150px"
                            value={jumpDate}
                            onChange={e => { setJumpDate(e.target.value); setJumpError(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleJump()}
                        />
                        <Button size="sm" onClick={handleJump} isDisabled={!jumpDate}>
                            Jump
                        </Button>
                    </HStack>
                    {jumpError && <Text fontSize="xs" color="red.400" mt={1}>{jumpError}</Text>}
                </Box>
            </HStack>

            {entries.length === 0 && !loading
                ? <Text color="gray.400" fontSize="sm">No past meals recorded yet.</Text>
                : (
                    <>
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

                        {totalPages > 1 && (
                            <HStack mt={3} justify="center" spacing={3}>
                                <Button
                                    size="sm"
                                    onClick={() => fetchPage(page - 1)}
                                    isDisabled={page === 0 || loading}
                                >
                                    Prev
                                </Button>
                                <Text fontSize="sm" color="gray.600">
                                    Page {page + 1} of {totalPages}
                                </Text>
                                <Button
                                    size="sm"
                                    onClick={() => fetchPage(page + 1)}
                                    isDisabled={page >= totalPages - 1 || loading}
                                >
                                    Next
                                </Button>
                            </HStack>
                        )}
                    </>
                )
            }
        </Box>
    );
}

export default History;
