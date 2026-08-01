import { useEffect, useState } from 'react';
import {
    Box, Button, Divider, HStack, Link, Modal, ModalBody, ModalCloseButton,
    ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { authFetch, recipeDomain } from '../utils/api';
import { printRecipe } from '../utils/printRecipe';

function formatDuration(val) {
    if (!val) return null;
    if (!/^PT/i.test(val)) return val;
    const h = val.match(/(\d+)H/i)?.[1];
    const m = val.match(/(\d+)M/i)?.[1];
    const parts = [];
    if (h) parts.push(`${h} hr`);
    if (m) parts.push(`${m} min`);
    return parts.length ? parts.join(' ') : null;
}

export default function RecipeViewModal({ recipeId, isOpen, onClose }) {
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !recipeId) return;
        setLoading(true);
        setRecipe(null);
        authFetch(`/api/recipes/${recipeId}`)
            .then(r => r.json())
            .then(d => { setRecipe(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [isOpen, recipeId]);

    let extData = null;
    if (recipe?.extendedData) {
        try { extData = JSON.parse(recipe.extendedData); } catch { /* ignore */ }
    }
    const groups = extData?.ingredientGroups?.length ? extData.ingredientGroups : null;
    const hasIngredients = groups || recipe?.ingredients?.length;
    const prep = formatDuration(extData?.prepTime);
    const cook = formatDuration(extData?.cookTime);
    const total = formatDuration(extData?.totalTime);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md" pr={10}>
                    {recipe ? recipe.name : 'Recipe'}
                    {recipe?.cookbookName && (
                        <Text fontSize="xs" fontWeight="normal" color="gray.400" mt="2px">
                            {recipe.cookbookName}
                        </Text>
                    )}
                    {recipe?.sourceUrl && (
                        <Link href={recipe.sourceUrl} isExternal fontSize="xs" fontWeight="normal" color="blue.400" display="block" mt="2px">
                            {recipeDomain(recipe.sourceUrl) ?? 'Source'} ↗
                        </Link>
                    )}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    {loading && (
                        <HStack justify="center" py={8}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="gray.500">Loading recipe…</Text>
                        </HStack>
                    )}

                    {recipe && (
                        <VStack align="stretch" spacing={4}>
                            {(extData?.description) && (
                                <Text fontSize="sm" color="gray.600">{extData.description}</Text>
                            )}

                            {(prep || cook || total || recipe.servings != null) && (
                                <HStack spacing={4} flexWrap="wrap">
                                    {recipe.servings != null && (
                                        <Text fontSize="xs" color="gray.500">Serves {recipe.servings}</Text>
                                    )}
                                    {prep && <Text fontSize="xs" color="gray.500">Prep: {prep}</Text>}
                                    {cook && <Text fontSize="xs" color="gray.500">Cook: {cook}</Text>}
                                    {total && <Text fontSize="xs" color="gray.500">Total: {total}</Text>}
                                </HStack>
                            )}

                            {hasIngredients && (
                                <Box>
                                    <Text fontWeight="semibold" fontSize="sm" mb={2}>Ingredients</Text>
                                    {groups ? (
                                        <VStack align="stretch" spacing={3}>
                                            {groups.map((g, i) => (
                                                <Box key={i}>
                                                    {g.name && (
                                                        <Text fontSize="xs" fontWeight="semibold" color="gray.500"
                                                              textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                                                            {g.name}
                                                        </Text>
                                                    )}
                                                    <VStack align="stretch" spacing={0}>
                                                        {(g.ingredients || g.items || []).map((item, j) => (
                                                            <Text key={j} fontSize="sm">• {item}</Text>
                                                        ))}
                                                    </VStack>
                                                </Box>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <VStack align="stretch" spacing={0}>
                                            {recipe.ingredients.map((ing, i) => (
                                                <Text key={i} fontSize="sm">• {ing}</Text>
                                            ))}
                                        </VStack>
                                    )}
                                </Box>
                            )}

                            {recipe.instructions && (
                                <>
                                    <Divider />
                                    <Box>
                                        <Text fontWeight="semibold" fontSize="sm" mb={2}>Instructions</Text>
                                        <Text fontSize="sm" whiteSpace="pre-wrap">{recipe.instructions}</Text>
                                    </Box>
                                </>
                            )}

                            {!hasIngredients && !recipe.instructions && (
                                <Text fontSize="sm" color="gray.400">No details added yet.</Text>
                            )}
                        </VStack>
                    )}
                </ModalBody>
                {recipe && (
                    <ModalFooter pt={2}>
                        <Button size="sm" variant="outline" onClick={() => printRecipe(recipe)}>
                            Print
                        </Button>
                        <Button size="sm" ml={3} onClick={onClose}>Close</Button>
                    </ModalFooter>
                )}
            </ModalContent>
        </Modal>
    );
}
