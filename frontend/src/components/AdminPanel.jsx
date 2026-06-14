import { useState, useEffect, useRef } from 'react';
import {
    Box, Button, Divider, Heading, HStack, Input, Tab, TabList, TabPanel, TabPanels,
    Tabs, Text, useToast, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

const PAGE_SIZE = 20;

function GlobalIngredients() {
    const [globals, setGlobals] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const inputRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/ingredients/global')
            .then(r => r.json())
            .then(setGlobals)
            .catch(console.error);
    }, []);

    const filtered = globals.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const r = await authFetch('/api/ingredients/global', {
                method: 'POST',
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Add failed', description: msg || undefined, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            const saved = await r.json();
            setGlobals(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName('');
            setSearch('');
            setPage(0);
            inputRef.current?.focus();
        } catch {
            toast({ title: 'Add failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (ing) => {
        try {
            const r = await authFetch(`/api/ingredients/${ing.id}`, { method: 'DELETE' });
            if (!r.ok) {
                toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
                return;
            }
            setGlobals(prev => prev.filter(i => i.id !== ing.id));
            if (page > 0 && paginated.length === 1) setPage(p => p - 1);
        } catch {
            toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    return (
        <Box>
            <Text fontSize="xs" color="gray.400" mb={4}>
                These ingredients are available to all households in autocomplete.
            </Text>

            <form onSubmit={handleAdd}>
                <HStack mb={3}>
                    <Input
                        ref={inputRef}
                        size="sm"
                        placeholder="Add ingredient…"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                    <Button type="submit" size="sm" colorScheme="green" isLoading={adding} flexShrink={0}>
                        Add
                    </Button>
                </HStack>
            </form>

            <Input
                size="sm"
                placeholder="Search ingredients…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                mb={3}
            />

            <Divider mb={3} />

            {filtered.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={6}>
                    {search ? 'No ingredients match your search.' : 'No global ingredients yet.'}
                </Text>
            )}

            <VStack align="stretch" spacing={0}>
                {paginated.map(ing => (
                    <HStack
                        key={ing.id}
                        py={2}
                        px={1}
                        justify="space-between"
                        borderBottomWidth="1px"
                        borderColor="gray.100"
                        _last={{ borderBottom: 'none' }}
                    >
                        <Text fontSize="sm">{ing.name}</Text>
                        {deleteConfirmId === ing.id ? (
                            <HStack spacing={1}>
                                <Text fontSize="xs" color="red.500">Delete?</Text>
                                <Button size="xs" colorScheme="red" onClick={() => handleDelete(ing)}>Yes</Button>
                                <Button size="xs" variant="ghost" onClick={() => setDeleteConfirmId(null)}>No</Button>
                            </HStack>
                        ) : (
                            <Button size="xs" variant="ghost" colorScheme="red" onClick={() => setDeleteConfirmId(ing.id)}>
                                Delete
                            </Button>
                        )}
                    </HStack>
                ))}
            </VStack>

            {totalPages > 1 && (
                <HStack mt={3} justify="center" spacing={3}>
                    <Button size="sm" onClick={() => setPage(p => p - 1)} isDisabled={page === 0}>Prev</Button>
                    <Text fontSize="sm" color="gray.600">Page {page + 1} of {totalPages}</Text>
                    <Button size="sm" onClick={() => setPage(p => p + 1)} isDisabled={page >= totalPages - 1}>Next</Button>
                </HStack>
            )}
        </Box>
    );
}

function GlobalCookbooks() {
    const [cookbooks, setCookbooks] = useState([]);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const inputRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/cookbooks/global')
            .then(r => r.json())
            .then(setCookbooks)
            .catch(console.error);
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const r = await authFetch('/api/cookbooks/global', {
                method: 'POST',
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Add failed', description: msg || undefined, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            const saved = await r.json();
            setCookbooks(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName('');
            inputRef.current?.focus();
        } catch {
            toast({ title: 'Add failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (cb) => {
        try {
            const r = await authFetch(`/api/cookbooks/${cb.id}`, { method: 'DELETE' });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Delete failed', description: msg, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            setCookbooks(prev => prev.filter(c => c.id !== cb.id));
        } catch {
            toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    return (
        <Box>
            <Text fontSize="xs" color="gray.400" mb={4}>
                Global cookbooks are available to all households as a grouping option for recipes.
            </Text>

            <form onSubmit={handleAdd}>
                <HStack mb={4}>
                    <Input
                        ref={inputRef}
                        size="sm"
                        placeholder="Add cookbook…"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                    <Button type="submit" size="sm" colorScheme="green" isLoading={adding} flexShrink={0}>
                        Add
                    </Button>
                </HStack>
            </form>

            <Divider mb={3} />

            {cookbooks.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={6}>
                    No global cookbooks yet.
                </Text>
            )}

            <VStack align="stretch" spacing={0}>
                {cookbooks.map(cb => (
                    <HStack
                        key={cb.id}
                        py={2}
                        px={1}
                        justify="space-between"
                        borderBottomWidth="1px"
                        borderColor="gray.100"
                        _last={{ borderBottom: 'none' }}
                    >
                        <Text fontSize="sm">{cb.name}</Text>
                        {deleteConfirmId === cb.id ? (
                            <HStack spacing={1}>
                                <Text fontSize="xs" color="red.500">Delete?</Text>
                                <Button size="xs" colorScheme="red" onClick={() => handleDelete(cb)}>Yes</Button>
                                <Button size="xs" variant="ghost" onClick={() => setDeleteConfirmId(null)}>No</Button>
                            </HStack>
                        ) : (
                            <Button size="xs" variant="ghost" colorScheme="red" onClick={() => setDeleteConfirmId(cb.id)}>
                                Delete
                            </Button>
                        )}
                    </HStack>
                ))}
            </VStack>
        </Box>
    );
}

function AdminPanel() {
    return (
        <Box>
            <Heading size="sm" mb={4}>Admin</Heading>
            <Tabs size="sm" variant="enclosed">
                <TabList>
                    <Tab>Ingredients</Tab>
                    <Tab>Cookbooks</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel px={0} pt={4}>
                        <GlobalIngredients />
                    </TabPanel>
                    <TabPanel px={0} pt={4}>
                        <GlobalCookbooks />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Box>
    );
}

export default AdminPanel;
