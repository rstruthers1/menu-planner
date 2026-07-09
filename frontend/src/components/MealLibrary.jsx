import { useState, useEffect } from 'react';
import {
    Badge, Box, Button, Checkbox, HStack, Input, Link, Modal, ModalBody, ModalCloseButton,
    ModalContent, ModalHeader, ModalOverlay, Tag, TagLabel, Text, useDisclosure,
    useToast, VStack,
} from '@chakra-ui/react';

import AddMealModal from './AddMealModal';
import { authFetch, recipeDomain } from '../utils/api';

const SEASONS = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
const SEASON_SHORT = { SPRING: 'Spr', SUMMER: 'Sum', FALL: 'Fall', WINTER: 'Win' };
const SEASON_COLORS = { SPRING: 'green', SUMMER: 'orange', FALL: 'yellow', WINTER: 'blue' };
const PAGE_SIZE = 15;

function tempLabel(minTemp, maxTemp) {
    if (minTemp != null && maxTemp != null) return `${minTemp}°–${maxTemp}°F`;
    if (minTemp != null) return `min ${minTemp}°F`;
    if (maxTemp != null) return `max ${maxTemp}°F`;
    return null;
}

function SeasonChips({ meal, onUpdate }) {
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const toggle = async (season) => {
        if (saving) return;
        const current = Array.isArray(meal.seasons) ? meal.seasons : [];
        const next = current.includes(season)
            ? current.filter(s => s !== season)
            : [...current, season];
        setSaving(true);
        try {
            await authFetch(`/api/meals/${meal.id}/seasons`, {
                method: 'PATCH',
                body: JSON.stringify({ seasons: next }),
            });
            onUpdate(meal.id, next);
        } catch {
            toast({ title: 'Could not update seasons', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setSaving(false);
        }
    };

    const active = Array.isArray(meal.seasons) ? meal.seasons : [];

    return (
        <HStack spacing={1} mt="4px" opacity={saving ? 0.5 : 1} title="Click to toggle season suitability">
            {SEASONS.map(s => (
                <Badge
                    key={s}
                    fontSize="9px"
                    px="5px"
                    py="1px"
                    cursor={saving ? 'not-allowed' : 'pointer'}
                    colorScheme={active.includes(s) ? SEASON_COLORS[s] : 'gray'}
                    variant={active.includes(s) ? 'subtle' : 'outline'}
                    onClick={() => toggle(s)}
                    userSelect="none"
                    _hover={{ opacity: 0.75 }}
                    transition="opacity 0.1s"
                >
                    {SEASON_SHORT[s]}
                </Badge>
            ))}
        </HStack>
    );
}

function RecipeModal({ recipe, isOpen, onClose }) {
    if (!recipe) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">📖 {recipe.name}</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <Box mb={4}>
                            <Text fontWeight="semibold" fontSize="sm" mb={2}>Ingredients</Text>
                            <VStack align="stretch" spacing={1}>
                                {recipe.ingredients.map(ing => (
                                    <Text key={ing} fontSize="sm">• {ing}</Text>
                                ))}
                            </VStack>
                        </Box>
                    )}
                    {recipe.instructions && (
                        <Box>
                            <Text fontWeight="semibold" fontSize="sm" mb={2}>Instructions</Text>
                            <Text fontSize="sm" whiteSpace="pre-wrap">{recipe.instructions}</Text>
                        </Box>
                    )}
                    {!recipe.ingredients?.length && !recipe.instructions && (
                        <Text fontSize="sm" color="gray.400">No details added yet.</Text>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

function MealLibrary({ onMealSaved }) {
    const [meals, setMeals] = useState([]);
    const [search, setSearch] = useState('');
    const [filterNoSeason, setFilterNoSeason] = useState(false);
    const [pinnedNoSeasonIds, setPinnedNoSeasonIds] = useState(null);
    const [page, setPage] = useState(0);
    const [editMeal, setEditMeal] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [recipeModal, setRecipeModal] = useState(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/meals')
            .then(r => r.json())
            .then(data => setMeals(data.sort((a, b) => a.name.localeCompare(b.name))))
            .catch(console.error);
    }, []);

    const handleSeasonUpdate = (mealId, newSeasons) => {
        setMeals(prev => prev.map(m => m.id === mealId ? { ...m, seasons: newSeasons } : m));
    };

    const filtered = meals.filter(m => {
        if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterNoSeason) {
            // Keep pinned meals visible even after they gain a season
            if (pinnedNoSeasonIds ? !pinnedNoSeasonIds.has(m.id) : (Array.isArray(m.seasons) && m.seasons.length > 0)) return false;
        }
        return true;
    });
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
            ? { ...saved, seasons: saved.seasons || [], sides: saved.sides || [], recipe: saved.recipe ?? null }
            : m
        ));
        onMealSaved?.(saved);
    };

    const handleAdded = (saved) => {
        setMeals(prev => [...prev, { ...saved, seasons: saved.seasons || [], sides: saved.sides || [], recipe: saved.recipe ?? null }]
            .sort((a, b) => a.name.localeCompare(b.name)));
        onMealSaved?.(saved);
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

    const noSeasonCount = meals.filter(m => !Array.isArray(m.seasons) || m.seasons.length === 0).length;

    return (
        <Box>
            <HStack mb={3}>
                <Input
                    placeholder="Search meal library…"
                    size="sm"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                />
                <Button size="sm" colorScheme="green" onClick={() => { setEditMeal(null); onOpen(); }} flexShrink={0}>
                    + Add meal
                </Button>
            </HStack>
            <HStack mb={4} spacing={3}>
                <Checkbox
                    size="sm"
                    isChecked={filterNoSeason}
                    onChange={e => {
                        const on = e.target.checked;
                        setFilterNoSeason(on);
                        setPage(0);
                        if (on) {
                            setPinnedNoSeasonIds(new Set(
                                meals.filter(m => !Array.isArray(m.seasons) || m.seasons.length === 0).map(m => m.id)
                            ));
                        } else {
                            setPinnedNoSeasonIds(null);
                        }
                    }}
                    colorScheme="orange"
                >
                    <Text fontSize="sm">No season set{noSeasonCount > 0 ? ` (${noSeasonCount})` : ''}</Text>
                </Checkbox>
                {filterNoSeason && (
                    <Text fontSize="xs" color="gray.400">Click the season chips below each meal to tag it</Text>
                )}
            </HStack>

            {filtered.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={8}>
                    {search || filterNoSeason ? 'No meals match your filter.' : 'No meals in library yet.'}
                </Text>
            )}

            <VStack align="stretch" spacing={0}>
                {paginated.map(meal => (
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
                                    {(() => {
                                        const url = meal.recipeLink || meal.recipe?.sourceUrl;
                                        return url ? (
                                            <Box>
                                                <Link
                                                    href={url}
                                                    isExternal
                                                    fontWeight="semibold"
                                                    fontSize="sm"
                                                    color="blue.600"
                                                    _hover={{ textDecoration: 'underline' }}
                                                >
                                                    {meal.name} ↗
                                                </Link>
                                                {recipeDomain(url) && (
                                                    <Text fontSize="xs" color="gray.400" lineHeight="1.2">{recipeDomain(url)}</Text>
                                                )}
                                            </Box>
                                        ) : (
                                            <Text fontWeight="semibold" fontSize="sm">{meal.name}</Text>
                                        );
                                    })()}
                                    {meal.shared && <Badge colorScheme="blue" fontSize="10px">shared</Badge>}
                                </HStack>

                                <SeasonChips meal={meal} onUpdate={handleSeasonUpdate} />

                                {hasTempConstraint(meal) && (
                                    <Box mt="4px">
                                        <Badge colorScheme="gray" fontSize="10px" variant="outline">
                                            🌡 {tempLabel(meal.minTemp, meal.maxTemp)}
                                        </Badge>
                                    </Box>
                                )}

                                {meal.sides && meal.sides.length > 0 && (
                                    <HStack spacing={1} mt="4px" flexWrap="wrap">
                                        <Text fontSize="xs" color="gray.500">Sides:</Text>
                                        {meal.sides.map(s => (
                                            <Tag key={s} size="sm" variant="subtle" colorScheme="gray" fontSize="10px">
                                                <TagLabel>{s}</TagLabel>
                                            </Tag>
                                        ))}
                                    </HStack>
                                )}

                                {meal.cookbookName && (
                                    <Tag size="sm" variant="subtle" colorScheme="orange" fontSize="10px" mt="4px">
                                        <TagLabel>{meal.cookbookName}</TagLabel>
                                    </Tag>
                                )}

                                {meal.recipe && (
                                    <Button
                                        size="xs"
                                        variant="link"
                                        colorScheme="orange"
                                        mt="4px"
                                        fontWeight="normal"
                                        fontSize="xs"
                                        onClick={() => setRecipeModal(meal.recipe)}
                                    >
                                        📖 {meal.recipe.name}
                                    </Button>
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

            {totalPages > 1 && (
                <HStack mt={3} justify="center" spacing={3}>
                    <Button size="sm" onClick={() => setPage(p => p - 1)} isDisabled={page === 0}>
                        Prev
                    </Button>
                    <Text fontSize="sm" color="gray.600">
                        Page {page + 1} of {totalPages}
                    </Text>
                    <Button size="sm" onClick={() => setPage(p => p + 1)} isDisabled={page >= totalPages - 1}>
                        Next
                    </Button>
                </HStack>
            )}

            <AddMealModal
                isOpen={isOpen}
                onClose={handleModalClose}
                editMeal={editMeal}
                onAdded={editMeal ? handleSaved : handleAdded}
            />
            <RecipeModal
                recipe={recipeModal}
                isOpen={!!recipeModal}
                onClose={() => setRecipeModal(null)}
            />
        </Box>
    );
}

export default MealLibrary;
