import { useState, useEffect } from 'react';
import {
    Badge, Box, Button, HStack, Input, Link, Text, useDisclosure, useToast, VStack,
} from '@chakra-ui/react';
import AddMealModal from './AddMealModal';
import { authFetch } from '../utils/api';

const SEASON_LABELS = { SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall', WINTER: 'Winter' };
const SEASON_COLORS = { SPRING: 'green', SUMMER: 'orange', FALL: 'yellow', WINTER: 'blue' };

function tempLabel(minTemp, maxTemp) {
    if (minTemp != null && maxTemp != null) return `${minTemp}°–${maxTemp}°F`;
    if (minTemp != null) return `min ${minTemp}°F`;
    if (maxTemp != null) return `max ${maxTemp}°F`;
    return null;
}

function MealLibrary() {
    const [meals, setMeals] = useState([]);
    const [search, setSearch] = useState('');
    const [editMeal, setEditMeal] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/meals')
            .then(r => r.json())
            .then(data => setMeals(data.sort((a, b) => a.name.localeCompare(b.name))))
            .catch(console.error);
    }, []);

    const filtered = meals.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (meal) => {
        setEditMeal(meal);
        onOpen();
    };

    const handleModalClose = () => {
        setEditMeal(null);
        onClose();
    };

    const handleSaved = (saved) => {
        setMeals(prev => prev.map(m => m.id === saved.id
            ? { ...saved, seasons: saved.seasons || [] }
            : m
        ));
    };

    const handleAdded = (saved) => {
        setMeals(prev => [...prev, { ...saved, seasons: saved.seasons || [] }]
            .sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handleDelete = async (meal) => {
        try {
            const r = await authFetch(`/api/meals/${meal.id}`, { method: 'DELETE' });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* use raw text */ }
                const title = r.status === 409 ? 'Cannot delete' : 'Delete failed';
                const status = r.status === 409 ? 'warning' : 'error';
                toast({ title, description: msg || undefined, status, duration: 4000, isClosable: true });
                return;
            }
            setMeals(prev => prev.filter(m => m.id !== meal.id));
        } catch {
            toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const hasTempConstraint = m => m.minTemp != null || m.maxTemp != null;
    const hasSeasons = m => Array.isArray(m.seasons) && m.seasons.length > 0;

    return (
        <Box>
            <HStack mb={4}>
                <Input
                    placeholder="Search meal library…"
                    size="sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <Button size="sm" colorScheme="green" onClick={() => { setEditMeal(null); onOpen(); }} flexShrink={0}>
                    + Add meal
                </Button>
            </HStack>

            {filtered.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={8}>
                    {search ? 'No meals match your search.' : 'No meals in library yet.'}
                </Text>
            )}

            <VStack align="stretch" spacing={0}>
                {filtered.map(meal => (
                    <Box
                        key={meal.id}
                        py={3}
                        px={1}
                        borderBottomWidth="1px"
                        borderColor="gray.100"
                        _last={{ borderBottom: 'none' }}
                    >
                        <HStack justify="space-between" align="flex-start">
                            <Box flex={1} minW={0}>
                                <HStack spacing={2} align="center" flexWrap="wrap">
                                    {meal.recipeLink ? (
                                        <Link
                                            href={meal.recipeLink}
                                            isExternal
                                            fontWeight="semibold"
                                            fontSize="sm"
                                            color="blue.600"
                                            _hover={{ textDecoration: 'underline' }}
                                        >
                                            {meal.name} ↗
                                        </Link>
                                    ) : (
                                        <Text fontWeight="semibold" fontSize="sm">{meal.name}</Text>
                                    )}
                                    {meal.shared && <Badge colorScheme="blue" fontSize="10px">shared</Badge>}
                                </HStack>

                                {(hasSeasons(meal) || hasTempConstraint(meal)) && (
                                    <HStack spacing={2} mt="4px" flexWrap="wrap">
                                        {hasSeasons(meal) && meal.seasons.map(s => (
                                            <Badge key={s} colorScheme={SEASON_COLORS[s]} fontSize="10px" variant="subtle">
                                                {SEASON_LABELS[s]}
                                            </Badge>
                                        ))}
                                        {hasTempConstraint(meal) && (
                                            <Badge colorScheme="gray" fontSize="10px" variant="outline">
                                                🌡 {tempLabel(meal.minTemp, meal.maxTemp)}
                                            </Badge>
                                        )}
                                    </HStack>
                                )}

                                {meal.notes && (
                                    <Text fontSize="xs" color="gray.400" mt="2px" noOfLines={1}>{meal.notes}</Text>
                                )}
                            </Box>

                            <HStack spacing={1} flexShrink={0}>
                                {deleteConfirmId === meal.id ? (
                                    <>
                                        <Text fontSize="xs" color="red.500">Delete?</Text>
                                        <Button size="xs" colorScheme="red" onClick={() => handleDelete(meal)}>Yes</Button>
                                        <Button size="xs" variant="ghost" onClick={() => setDeleteConfirmId(null)}>No</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="xs" variant="ghost" colorScheme="blue" onClick={() => handleEdit(meal)}>Edit</Button>
                                        <Button size="xs" variant="ghost" colorScheme="red" onClick={() => setDeleteConfirmId(meal.id)}>Delete</Button>
                                    </>
                                )}
                            </HStack>
                        </HStack>
                    </Box>
                ))}
            </VStack>

            <AddMealModal
                isOpen={isOpen}
                onClose={handleModalClose}
                editMeal={editMeal}
                onAdded={editMeal ? handleSaved : handleAdded}
            />
        </Box>
    );
}

export default MealLibrary;
