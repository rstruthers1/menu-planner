import { useState, useEffect, useRef } from 'react';
import {
    Box, Button, Divider, Heading, HStack, Input, Text, useToast, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

function AdminPanel() {
    const [globals, setGlobals] = useState([]);
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
        } catch {
            toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    return (
        <Box>
            <Heading size="sm" mb={1}>Global Ingredient List</Heading>
            <Text fontSize="xs" color="gray.400" mb={4}>
                These ingredients are available to all households in autocomplete.
            </Text>

            <form onSubmit={handleAdd}>
                <HStack mb={4}>
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

            <Divider mb={3} />

            {globals.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={6}>
                    No global ingredients yet.
                </Text>
            )}

            <VStack align="stretch" spacing={0}>
                {globals.map(ing => (
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
        </Box>
    );
}

export default AdminPanel;
