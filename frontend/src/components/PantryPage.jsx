import { useEffect, useState } from 'react';
import {
    Box, Button, Divider, HStack, Heading, Spinner, Text, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import IngredientRows from './IngredientRows';

const SECTIONS = [
    { key: 'refrigerator', label: 'Refrigerator', icon: '🧊', color: 'blue.600' },
    { key: 'freezer',      label: 'Freezer',      icon: '❄️',  color: 'cyan.600' },
    { key: 'cupboard',     label: 'Cupboard / Pantry', icon: '🗄️', color: 'orange.600' },
];

const EMPTY = { refrigerator: [], freezer: [], cupboard: [] };

export default function PantryPage() {
    const [items, setItems] = useState(EMPTY);
    const [original, setOriginal] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/pantry')
            .then(r => r.json())
            .then(d => {
                const loaded = {
                    refrigerator: d.refrigerator || [],
                    freezer: d.freezer || [],
                    cupboard: d.cupboard || [],
                };
                setItems(loaded);
                setOriginal(loaded);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const isDirty = JSON.stringify(items) !== JSON.stringify(original);

    const handleSave = async () => {
        setSaving(true);
        try {
            const body = {
                refrigerator: items.refrigerator.filter(i => i.trim()),
                freezer: items.freezer.filter(i => i.trim()),
                cupboard: items.cupboard.filter(i => i.trim()),
            };
            const r = await authFetch('/api/pantry', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            const saved = await r.json();
            const loaded = {
                refrigerator: saved.refrigerator || [],
                freezer: saved.freezer || [],
                cupboard: saved.cupboard || [],
            };
            setItems(loaded);
            setOriginal(loaded);
            toast({ title: 'Pantry saved', status: 'success', duration: 2000, isClosable: true });
        } catch {
            toast({ title: 'Save failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <HStack justify="center" py={12}>
                <Spinner size="sm" />
                <Text fontSize="sm" color="gray.500">Loading pantry…</Text>
            </HStack>
        );
    }

    return (
        <Box>
            <HStack justify="space-between" mb={4} align="flex-start">
                <Box>
                    <Text fontSize="sm" color="gray.500">
                        Items listed here are marked "have it" on the shopping list.
                    </Text>
                    <Text fontSize="xs" color="gray.400" mt={1}>
                        Use plain names — "eggs", "olive oil", "garlic" — no quantities needed.
                    </Text>
                </Box>
                <Button
                    colorScheme="teal"
                    size="sm"
                    onClick={handleSave}
                    isLoading={saving}
                    isDisabled={!isDirty}
                    flexShrink={0}
                >
                    Save
                </Button>
            </HStack>

            {SECTIONS.map((sec, i) => (
                <Box key={sec.key}>
                    <Heading size="xs" color={sec.color} mb={2} mt={i === 0 ? 0 : 5}>
                        {sec.icon}  {sec.label}
                    </Heading>
                    <IngredientRows
                        value={items[sec.key]}
                        onChange={val => setItems(prev => ({ ...prev, [sec.key]: val }))}
                        suggestionsUrl="/api/ingredients/search"
                    />
                    {i < SECTIONS.length - 1 && <Divider mt={4} />}
                </Box>
            ))}

            {isDirty && (
                <HStack justify="flex-end" mt={6}>
                    <Button
                        colorScheme="teal"
                        size="sm"
                        onClick={handleSave}
                        isLoading={saving}
                    >
                        Save
                    </Button>
                </HStack>
            )}
        </Box>
    );
}
