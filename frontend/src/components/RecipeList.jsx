import { useState, useEffect } from 'react';
import {
    Alert, AlertDescription, AlertIcon, Badge, Box, Button, Divider, HStack, Input, Link,
    Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
    Select, Tag, TagLabel, Text, useDisclosure, useToast, VStack,
} from '@chakra-ui/react';
import { authFetch, recipeDomain } from '../utils/api';
import RecipeDialog from './RecipeDialog';
import CookbookManager from './CookbookManager';

const PAGE_SIZE = 15;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekStartFor(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSimilar(a, b) {
    const al = a.toLowerCase().trim(), bl = b.toLowerCase().trim();
    return al === bl || al.includes(bl) || bl.includes(al);
}

function formatDuration(val) {
    if (!val) return null;
    // Already human-readable (e.g. "15 minutes" from Claude)
    if (!/^PT/i.test(val)) return val;
    // ISO 8601 duration: PT15M, PT1H, PT1H30M
    const h = val.match(/(\d+)H/i)?.[1];
    const m = val.match(/(\d+)M/i)?.[1];
    const parts = [];
    if (h) parts.push(`${h} hr`);
    if (m) parts.push(`${m} min`);
    return parts.length ? parts.join(' ') : null;
}

function ExtendedDataPanel({ recipe }) {
    const [show, setShow] = useState(false);
    if (!recipe.extendedData) return null;
    let data;
    try { data = JSON.parse(recipe.extendedData); } catch { return null; }
    if (!data || typeof data !== 'object') return null;

    const prep = formatDuration(data.prepTime);
    const cook = formatDuration(data.cookTime);
    const total = formatDuration(data.totalTime);
    const hasGroups = Array.isArray(data.ingredientGroups) && data.ingredientGroups.length > 0;
    const hasTiming = prep || cook || total;
    const flatIngredients = !hasGroups && recipe.ingredients?.length ? recipe.ingredients : null;
    const hasAnything = data.description || hasTiming || hasGroups || flatIngredients || data.category || data.cuisine || data.keywords || recipe.instructions;
    if (!hasAnything) return null;

    return (
        <Box mt={4}>
            <Button size="xs" variant="outline" colorScheme="purple" onClick={() => setShow(s => !s)}>
                {show ? 'Hide' : '✦ Extended data (experimental)'}
            </Button>
            {show && (
                <Box mt={3} p={3} bg="purple.50" borderRadius="md">
                    {data.description && (
                        <Box mb={3}>
                            <Text fontSize="xs" fontWeight="semibold" color="purple.700" mb={1}>Description</Text>
                            <Text fontSize="xs" color="gray.700">{data.description}</Text>
                        </Box>
                    )}
                    {hasTiming && (
                        <Box mb={3}>
                            <Text fontSize="xs" fontWeight="semibold" color="purple.700" mb={1}>Timing</Text>
                            <HStack spacing={4}>
                                {prep && <Text fontSize="xs" color="gray.700">Prep: {prep}</Text>}
                                {cook && <Text fontSize="xs" color="gray.700">Cook: {cook}</Text>}
                                {total && <Text fontSize="xs" color="gray.700">Total: {total}</Text>}
                            </HStack>
                        </Box>
                    )}
                    {(data.category || data.cuisine) && (
                        <Box mb={3}>
                            <HStack spacing={4}>
                                {data.category && <Text fontSize="xs" color="gray.700">Category: {data.category}</Text>}
                                {data.cuisine && <Text fontSize="xs" color="gray.700">Cuisine: {data.cuisine}</Text>}
                            </HStack>
                        </Box>
                    )}
                    {data.keywords && (
                        <Box mb={3}>
                            <Text fontSize="xs" color="gray.500">Keywords: {data.keywords}</Text>
                        </Box>
                    )}
                    {hasGroups && (
                        <Box mb={3}>
                            <Text fontSize="xs" fontWeight="semibold" color="purple.700" mb={2}>Ingredient groups</Text>
                            {data.ingredientGroups.map((g, i) => (
                                <Box key={i} mb={2}>
                                    <Text fontSize="xs" fontWeight="medium" color="gray.600" mb={1}>{g.name}</Text>
                                    <VStack align="stretch" spacing={0}>
                                        {(g.items || []).map((item, j) => (
                                            <Text key={j} fontSize="xs" color="gray.700">• {item}</Text>
                                        ))}
                                    </VStack>
                                </Box>
                            ))}
                        </Box>
                    )}

                    {flatIngredients && (
                        <Box mb={3}>
                            <Text fontSize="xs" fontWeight="semibold" color="purple.700" mb={1}>Ingredients</Text>
                            <VStack align="stretch" spacing={0}>
                                {flatIngredients.map((ing, i) => (
                                    <Text key={i} fontSize="xs" color="gray.700">• {ing}</Text>
                                ))}
                            </VStack>
                        </Box>
                    )}

                    {recipe.instructions && (
                        <Box>
                            <Text fontSize="xs" fontWeight="semibold" color="purple.700" mb={1}>Instructions</Text>
                            <Text fontSize="xs" color="gray.700" whiteSpace="pre-wrap">{recipe.instructions}</Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}

function ScaleModal({ recipe, isOpen, onClose }) {
    const [target, setTarget] = useState('');
    if (!recipe) return null;
    const base = recipe.servings;
    const targetNum = target !== '' ? Number(target) : null;
    const multiplier = base && targetNum && targetNum > 0 ? (targetNum / base).toFixed(2) : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">
                    <HStack spacing={3} align="baseline" flexWrap="wrap">
                        <Text>{recipe.name}</Text>
                        {recipe.mealName && (
                            <Text fontSize="xs" fontWeight="normal" color="gray.400">— {recipe.mealName}</Text>
                        )}
                        {recipe.sourceUrl && (
                            <Link href={recipe.sourceUrl} isExternal fontSize="xs" fontWeight="normal" color="blue.400">
                                {recipeDomain(recipe.sourceUrl) ?? 'Source'} ↗
                            </Link>
                        )}
                    </HStack>
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    {base != null && (
                        <HStack mb={4} spacing={3} align="center">
                            <Text fontSize="sm" color="gray.600">Base: {base} servings</Text>
                            <Text fontSize="sm" color="gray.400">→</Text>
                            <Input
                                type="number"
                                size="sm"
                                w="80px"
                                placeholder={String(base)}
                                value={target}
                                onChange={e => setTarget(e.target.value)}
                            />
                            <Text fontSize="sm" color="gray.600">servings</Text>
                            {multiplier && (
                                <Badge colorScheme="purple" fontSize="xs">×{multiplier}</Badge>
                            )}
                        </HStack>
                    )}

                    {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <Box mb={4}>
                            <Text fontWeight="semibold" fontSize="sm" mb={2}>Ingredients</Text>
                            {multiplier && (
                                <Text fontSize="xs" color="purple.500" mb={2}>
                                    Multiply each amount by {multiplier}
                                </Text>
                            )}
                            <VStack align="stretch" spacing={1}>
                                {recipe.ingredients.map(ing => (
                                    <Text key={ing} fontSize="sm">• {ing}</Text>
                                ))}
                            </VStack>
                        </Box>
                    )}

                    {recipe.instructions && (
                        <>
                            <Divider mb={3} />
                            <Box>
                                <Text fontWeight="semibold" fontSize="sm" mb={2}>Instructions</Text>
                                <Text fontSize="sm" whiteSpace="pre-wrap">{recipe.instructions}</Text>
                            </Box>
                        </>
                    )}

                    {!recipe.ingredients?.length && !recipe.instructions && (
                        <Text fontSize="sm" color="gray.400">No details added yet.</Text>
                    )}

                    <ExtendedDataPanel recipe={recipe} />
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

function RecipeList({ mealLibrary, onMealCreated }) {
    const [recipes, setRecipes] = useState([]);
    const [cookbooks, setCookbooks] = useState([]);
    const [search, setSearch] = useState('');
    const [cookbookFilter, setCookbookFilter] = useState('');
    const [page, setPage] = useState(0);
    const [editRecipe, setEditRecipe] = useState(null);
    const [viewRecipe, setViewRecipe] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [planRecipe, setPlanRecipe] = useState(null);
    const [planName, setPlanName] = useState('');
    const [planDate, setPlanDate] = useState('');
    const [planSaving, setPlanSaving] = useState(false);
    const [planWarning, setPlanWarning] = useState(null);
    const { isOpen: isDialogOpen, onOpen: onDialogOpen, onClose: onDialogClose } = useDisclosure();
    const { isOpen: isScaleOpen, onOpen: onScaleOpen, onClose: onScaleClose } = useDisclosure();
    const { isOpen: isCookbookMgrOpen, onOpen: onCookbookMgrOpen, onClose: onCookbookMgrClose } = useDisclosure();
    const { isOpen: isPlanOpen, onOpen: onPlanOpen, onClose: onPlanClose } = useDisclosure();
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/recipes')
            .then(r => r.json())
            .then(data => setRecipes(data))
            .catch(console.error);
        authFetch('/api/cookbooks')
            .then(r => r.json())
            .then(data => setCookbooks(data))
            .catch(console.error);
    }, []);

    const filtered = recipes.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
            (r.mealName && r.mealName.toLowerCase().includes(search.toLowerCase()));
        const matchesCookbook = cookbookFilter === ''
            ? true
            : cookbookFilter === '__none__'
                ? r.cookbookId == null
                : String(r.cookbookId) === cookbookFilter;
        return matchesSearch && matchesCookbook;
    });
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleEdit = (recipe) => {
        setEditRecipe(recipe);
        onDialogOpen();
    };

    const handleDialogClose = () => {
        setEditRecipe(null);
        onDialogClose();
    };

    const handleSaved = (saved) => {
        setRecipes(prev => {
            const exists = prev.find(r => r.id === saved.id);
            const next = exists
                ? prev.map(r => r.id === saved.id ? saved : r)
                : [...prev, saved];
            return next.sort((a, b) => a.name.localeCompare(b.name));
        });
    };

    const handleDelete = async (recipe) => {
        try {
            const r = await authFetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Delete failed', description: msg || undefined, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            setRecipes(prev => prev.filter(r => r.id !== recipe.id));
        } catch {
            toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const openView = (recipe) => {
        setViewRecipe(recipe);
        onScaleOpen();
    };

    const handleCookbookCreated = (cb) => {
        setCookbooks(prev => [...prev, cb].sort((a, b) => {
            if (a.global !== b.global) return a.global ? 1 : -1;
            return a.name.localeCompare(b.name);
        }));
    };

    const handleCookbookDeleted = (id) => {
        setCookbooks(prev => prev.filter(c => c.id !== id));
    };

    const openAddToPlanner = (recipe) => {
        setPlanRecipe(recipe);
        setPlanName(recipe.name);
        setPlanDate(todayStr());
        setPlanWarning(null);
        onPlanOpen();
    };

    const doPost = async () => {
        const d = new Date(planDate + 'T00:00:00');
        const dayOfWeek = DAY_NAMES[d.getDay()];
        const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const r = await authFetch('/api/menus', {
            method: 'POST',
            body: JSON.stringify({
                mealDate: planDate,
                dayOfWeek,
                mealName: planName.trim(),
                confirmed: false,
                leftover: false,
                leftoverFromDate: null,
                recipeLink: null,
                notes: null,
                minTemp: null,
                maxTemp: null,
                seasons: [],
            }),
        });
        if (!r.ok) throw new Error();
        toast({ title: `Added to planner for ${dateLabel}`, status: 'success', duration: 3000, isClosable: true });
        onPlanClose();
    };

    const handleAddToPlanner = async (force = false) => {
        if (!planDate || !planName.trim()) return;
        setPlanSaving(true);
        try {
            if (!force) {
                const weekR = await authFetch(`/api/menus/week?start=${weekStartFor(planDate)}`);
                const weekEntries = weekR.ok ? await weekR.json() : [];
                const dateConflict = weekEntries.find(e => e.mealDate === planDate);
                const nameConflict = !dateConflict && weekEntries.find(e => isSimilar(e.mealName, planName.trim()));
                if (dateConflict) {
                    const label = new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                    setPlanWarning(`There's already "${dateConflict.mealName}" planned for ${label}.`);
                    return;
                }
                if (nameConflict) {
                    const label = new Date(nameConflict.mealDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                    setPlanWarning(`"${nameConflict.mealName}" is already on the menu for ${label}.`);
                    return;
                }
            }
            await doPost();
        } catch {
            toast({ title: 'Failed to add to planner', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setPlanSaving(false);
        }
    };

    return (
        <Box>
            <HStack mb={3} spacing={2}>
                <Input
                    placeholder="Search recipes…"
                    size="sm"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                />
                <Select
                    size="sm"
                    value={cookbookFilter}
                    onChange={e => { setCookbookFilter(e.target.value); setPage(0); }}
                    placeholder="All cookbooks"
                    flexShrink={0}
                    w="180px"
                >
                    <option value="__none__">No cookbook</option>
                    {cookbooks.map(cb => (
                        <option key={cb.id} value={String(cb.id)}>
                            {cb.name}{cb.global ? ' ✦' : ''}
                        </option>
                    ))}
                </Select>
            </HStack>

            <HStack mb={4} justify="space-between">
                <Button size="sm" colorScheme="green" onClick={() => { setEditRecipe(null); onDialogOpen(); }}>
                    + Add recipe
                </Button>
                <Button size="sm" variant="outline" onClick={onCookbookMgrOpen}>
                    Manage cookbooks
                </Button>
            </HStack>

            {filtered.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={8}>
                    {search || cookbookFilter ? 'No recipes match your filters.' : 'No recipes yet.'}
                </Text>
            )}

            <VStack align="stretch" spacing={0}>
                {paginated.map(recipe => (
                    <Box
                        key={recipe.id}
                        py={3}
                        px={1}
                        borderBottomWidth="1px"
                        borderColor="gray.100"
                        _last={{ borderBottom: 'none' }}
                    >
                        <HStack justify="space-between" align="flex-start">
                            <Box flex={1} minW={0}>
                                <HStack spacing={2} align="center" flexWrap="wrap">
                                    <Button
                                        variant="link"
                                        fontWeight="semibold"
                                        fontSize="sm"
                                        color="blue.600"
                                        onClick={() => openView(recipe)}
                                        _hover={{ textDecoration: 'underline' }}
                                    >
                                        {recipe.name}
                                    </Button>
                                    {recipe.servings != null && (
                                        <Text fontSize="xs" color="gray.400">
                                            {recipe.servings} servings
                                        </Text>
                                    )}
                                    {recipe.cookbookName && (
                                        <Tag size="sm" variant="subtle" colorScheme="orange" fontSize="10px">
                                            <TagLabel>{recipe.cookbookName}</TagLabel>
                                        </Tag>
                                    )}
                                    {recipe.sourceUrl && (
                                        <Link href={recipe.sourceUrl} isExternal fontSize="xs" color="blue.400">
                                            {recipeDomain(recipe.sourceUrl) ?? 'Source'} ↗
                                        </Link>
                                    )}
                                </HStack>

                                {recipe.mealName && (
                                    <HStack spacing={1} mt="3px">
                                        <Text fontSize="xs" color="gray.400">Linked to:</Text>
                                        <Tag size="sm" variant="subtle" colorScheme="teal" fontSize="10px">
                                            <TagLabel>{recipe.mealName}</TagLabel>
                                        </Tag>
                                    </HStack>
                                )}

                                {recipe.ingredients && recipe.ingredients.length > 0 && (
                                    <Text fontSize="xs" color="gray.400" mt="2px" noOfLines={1}>
                                        {recipe.ingredients.join(', ')}
                                    </Text>
                                )}
                            </Box>

                            <HStack spacing={1} flexShrink={0}>
                                {deleteConfirmId === recipe.id ? (
                                    <>
                                        <Text fontSize="xs" color="red.500">Delete?</Text>
                                        <Button size="xs" colorScheme="red" onClick={() => handleDelete(recipe)}>Yes</Button>
                                        <Button size="xs" variant="ghost" onClick={() => setDeleteConfirmId(null)}>No</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="xs" variant="ghost" colorScheme="green" onClick={() => openAddToPlanner(recipe)}>Plan</Button>
                                        <Button size="xs" variant="ghost" colorScheme="blue" onClick={() => handleEdit(recipe)}>Edit</Button>
                                        <Button size="xs" variant="ghost" colorScheme="red" onClick={() => setDeleteConfirmId(recipe.id)}>Delete</Button>
                                    </>
                                )}
                            </HStack>
                        </HStack>
                    </Box>
                ))}
            </VStack>

            {totalPages > 1 && (
                <HStack mt={3} justify="center" spacing={3}>
                    <Button size="sm" onClick={() => setPage(p => p - 1)} isDisabled={page === 0}>Prev</Button>
                    <Text fontSize="sm" color="gray.600">Page {page + 1} of {totalPages}</Text>
                    <Button size="sm" onClick={() => setPage(p => p + 1)} isDisabled={page >= totalPages - 1}>Next</Button>
                </HStack>
            )}

            <RecipeDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                editRecipe={editRecipe}
                meals={mealLibrary}
                cookbooks={cookbooks}
                onSaved={handleSaved}
                onCookbookCreated={handleCookbookCreated}
                onMealCreated={onMealCreated}
            />
            <ScaleModal
                recipe={viewRecipe}
                isOpen={isScaleOpen}
                onClose={() => { onScaleClose(); setViewRecipe(null); }}
            />
            <CookbookManager
                isOpen={isCookbookMgrOpen}
                onClose={onCookbookMgrClose}
                cookbooks={cookbooks}
                onCreated={handleCookbookCreated}
                onDeleted={handleCookbookDeleted}
            />

            <Modal isOpen={isPlanOpen} onClose={onPlanClose} size="sm">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader fontSize="md">Add to planner</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={4}>
                        <VStack spacing={3} align="stretch">
                            <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>Meal name</Text>
                                <Input
                                    size="sm"
                                    value={planName}
                                    onChange={e => { setPlanName(e.target.value); setPlanWarning(null); }}
                                    onKeyDown={e => { if (e.key === 'Enter' && !planWarning) handleAddToPlanner(); }}
                                />
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>Date</Text>
                                <Input
                                    type="date"
                                    size="sm"
                                    value={planDate}
                                    onChange={e => { setPlanDate(e.target.value); setPlanWarning(null); }}
                                />
                            </Box>
                            {planWarning && (
                                <Alert status="warning" borderRadius="md" py={2}>
                                    <AlertIcon boxSize="14px" />
                                    <AlertDescription fontSize="xs">{planWarning}</AlertDescription>
                                </Alert>
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        {planWarning ? (
                            <>
                                <Button
                                    colorScheme="green"
                                    size="sm"
                                    mr={2}
                                    isLoading={planSaving}
                                    onClick={() => handleAddToPlanner(true)}
                                >
                                    Add anyway
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setPlanWarning(null)}>Pick different day</Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    colorScheme="green"
                                    size="sm"
                                    mr={2}
                                    isLoading={planSaving}
                                    isDisabled={!planDate || !planName.trim()}
                                    onClick={() => handleAddToPlanner(false)}
                                >
                                    Add to planner
                                </Button>
                                <Button size="sm" variant="ghost" onClick={onPlanClose}>Cancel</Button>
                            </>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
}

export default RecipeList;
