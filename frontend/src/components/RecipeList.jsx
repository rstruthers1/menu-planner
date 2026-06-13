import { useState, useEffect } from 'react';
import {
    Badge, Box, Button, Divider, HStack, Input, Modal, ModalBody, ModalCloseButton,
    ModalContent, ModalHeader, ModalOverlay, Tag, TagLabel, Text, useDisclosure,
    useToast, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import RecipeDialog from './RecipeDialog';

const PAGE_SIZE = 15;

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
                    {recipe.name}
                    {recipe.mealName && (
                        <Text as="span" fontSize="xs" fontWeight="normal" color="gray.400" ml={2}>
                            — {recipe.mealName}
                        </Text>
                    )}
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
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

function RecipeList({ mealLibrary }) {
    const [recipes, setRecipes] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [editRecipe, setEditRecipe] = useState(null);
    const [viewRecipe, setViewRecipe] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const { isOpen: isDialogOpen, onOpen: onDialogOpen, onClose: onDialogClose } = useDisclosure();
    const { isOpen: isScaleOpen, onOpen: onScaleOpen, onClose: onScaleClose } = useDisclosure();
    const toast = useToast();

    useEffect(() => {
        authFetch('/api/recipes')
            .then(r => r.json())
            .then(data => setRecipes(data))
            .catch(console.error);
    }, []);

    const filtered = recipes.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.mealName && r.mealName.toLowerCase().includes(search.toLowerCase()))
    );
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

    return (
        <Box>
            <HStack mb={4}>
                <Input
                    placeholder="Search recipes…"
                    size="sm"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                />
                <Button size="sm" colorScheme="green" onClick={() => { setEditRecipe(null); onDialogOpen(); }} flexShrink={0}>
                    + Add recipe
                </Button>
            </HStack>

            {filtered.length === 0 && (
                <Text fontSize="sm" color="gray.400" textAlign="center" py={8}>
                    {search ? 'No recipes match your search.' : 'No recipes yet.'}
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
                onSaved={handleSaved}
            />
            <ScaleModal
                recipe={viewRecipe}
                isOpen={isScaleOpen}
                onClose={() => { onScaleClose(); setViewRecipe(null); }}
            />
        </Box>
    );
}

export default RecipeList;
