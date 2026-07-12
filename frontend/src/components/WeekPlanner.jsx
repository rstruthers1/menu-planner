import { useEffect, useRef, useState } from 'react';
import {
    AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
    AlertDialogHeader, AlertDialogOverlay, Button, HStack, Tag, TagLabel, Text, useDisclosure,
} from '@chakra-ui/react';
import { closestCenter, DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import AddMealModal from './AddMealModal';
import AiChatModal from './AiChatModal';
import CandidateTray from './CandidateTray';
import DayRow from './DayRow';
import MealDetailModal from './MealDetailModal';
import WeekHelper from './WeekHelper';
import SuggestPanel from './SuggestPanel';
import { authFetch } from '../utils/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AI_ENABLED = false;

function getSeason(dateStr) {
    const m = new Date(dateStr + 'T00:00:00').getMonth() + 1;
    if (m >= 3 && m <= 5) return 'SPRING';
    if (m >= 6 && m <= 8) return 'SUMMER';
    if (m >= 9 && m <= 11) return 'FALL';
    return 'WINTER';
}

function WeekPlanner({ weekStart, entries, setEntries, weather, mealLibrary, setMealLibrary, toDateStr }) {
    const mealSuggestions = [...new Set(mealLibrary.map(m => m.name))].sort();
    const [detailDay, setDetailDay] = useState(null);
    const [aiChatDay, setAiChatDay] = useState(null);
    const [candidates, setCandidates] = useState(() => {
        try { return JSON.parse(localStorage.getItem('candidateMeals') || '[]'); } catch { return []; }
    });
    const [activeId, setActiveId] = useState(null);
    const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();
    const { isOpen: isAddMealOpen, onOpen: onAddMealOpen, onClose: onAddMealClose } = useDisclosure();
    const cancelRef = useRef();

    useEffect(() => {
        localStorage.setItem('candidateMeals', JSON.stringify(candidates));
    }, [candidates]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { date: d, dateStr: toDateStr(d), dayName: DAY_NAMES[i] };
    });

    const entriesByDate = {};
    entries.forEach(e => { entriesByDate[e.mealDate] = e; });

    const handleSave = (dateStr, dayName, mealName) => {
        const existing = entriesByDate[dateStr];

        if (!mealName.trim()) {
            if (existing) {
                authFetch(`/api/menus/${existing.id}`, { method: 'DELETE' })
                    .then(() => setEntries(prev => prev.filter(e => e.mealDate !== dateStr)))
                    .catch(console.error);
            }
            return;
        }

        const libraryMeal = mealLibrary.find(m => m.name === mealName.trim());

        const body = {
            mealDate: dateStr,
            dayOfWeek: dayName,
            mealName: mealName.trim(),
            confirmed: existing?.confirmed ?? false,
            leftover: existing?.leftover ?? false,
            leftoverFromDate: existing?.leftoverFromDate ?? null,
            recipeLink: libraryMeal?.recipeLink ?? null,
            notes: libraryMeal?.notes ?? null,
            minTemp: libraryMeal?.minTemp ?? null,
            maxTemp: libraryMeal?.maxTemp ?? null,
            seasons: libraryMeal?.seasons ?? [],
        };

        const addSuggestion = (updated) => {
            if (updated?.mealName && !mealLibrary.some(m => m.name === updated.mealName)) {
                setMealLibrary(prev => [...prev, {
                    id: updated.mealId,
                    name: updated.mealName,
                    recipeLink: updated.recipeLink ?? null,
                    notes: updated.notes ?? null,
                    minTemp: updated.minTemp ?? null,
                    maxTemp: updated.maxTemp ?? null,
                    seasons: updated.seasons || [],
                }].sort((a, b) => a.name.localeCompare(b.name)));
            }
        };

        if (existing) {
            authFetch(`/api/menus/${existing.id}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            })
                .then(r => r.json())
                .then(updated => {
                    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
                    addSuggestion(updated);
                })
                .catch(console.error);
        } else {
            authFetch('/api/menus', {
                method: 'POST',
                body: JSON.stringify(body),
            })
                .then(r => r.json())
                .then(created => {
                    setEntries(prev => [...prev, created]);
                    addSuggestion(created);
                })
                .catch(console.error);
        }
    };

    const handleToggleConfirmed = (entry) => {
        authFetch(`/api/menus/${entry.id}/confirmed`, {
            method: 'PATCH',
            body: JSON.stringify({ confirmed: !entry.confirmed }),
        })
            .then(r => r.json())
            .then(updated => setEntries(prev => prev.map(e => e.id === updated.id ? updated : e)))
            .catch(console.error);
    };

    const handleClearWeek = () => {
        const weekEntries = entries.filter(e => days.some(d => d.dateStr === e.mealDate));
        Promise.all(weekEntries.map(e => authFetch(`/api/menus/${e.id}`, { method: 'DELETE' })))
            .then(() => setEntries(prev => prev.filter(e => !days.some(d => d.dateStr === e.mealDate))))
            .catch(console.error);
        onAlertClose();
    };

    const handlePrint = () => {
        const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const icon = (condition) => {
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
        };

        const rows = days.map(({ dateStr, dayName }) => {
            const entry = entriesByDate[dateStr];
            const w = weather[dateStr];
            const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const meal = entry?.mealName || '—';
            const leftoverNote = entry?.leftover ? ' <span style="color:#999;font-size:11px">(leftovers)</span>' : '';
            const confirmed = entry && !entry.confirmed ? ' <span style="color:#aaa;font-size:11px">idea</span>' : '';
            const cookbookNote = entry?.cookbookName ? `<br><span style="color:#888;font-size:11px">${entry.cookbookName}</span>` : '';
            const weatherStr = w
                ? `${icon(w.condition)} ${w.condition || ''} ${w.high !== undefined ? `${w.high}°/${w.low}°` : ''}`.trim()
                : '—';
            return `<tr>
                <td><strong>${dayName}</strong><br><span style="color:#888;font-size:11px">${dateLabel}</span></td>
                <td>${meal}${leftoverNote}${confirmed}${cookbookNote}</td>
                <td style="white-space:nowrap">${weatherStr}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html><head>
<title>Meal Plan — Week of ${weekLabel}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 32px; color: #222; }
  h1 { font-size: 18px; margin-bottom: 20px; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 7px 12px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 13px; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
</style>
</head><body>
<h1>Meal Plan — Week of ${weekLabel}</h1>
<table>
  <thead><tr><th>Day</th><th>Meal</th><th>Weather</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

        const win = window.open('', '_blank', 'width=720,height=520');
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
    };

    const handleDragEnd = ({ active, over }) => {
        setActiveId(null);
        if (!over) return;

        const overId = over.id;

        if (overId === 'candidate-tray') {
            if (!active.id.startsWith('day:')) return;
            const sourceDateStr = active.id.slice(4);
            const sourceEntry = entriesByDate[sourceDateStr];
            if (!sourceEntry?.mealName) return;
            const sourceDay = days.find(d => d.dateStr === sourceDateStr);
            setCandidates(prev => prev.includes(sourceEntry.mealName) ? prev : [...prev, sourceEntry.mealName]);
            if (sourceDay) handleSave(sourceDateStr, sourceDay.dayName, '');
            return;
        }

        const targetDay = days.find(d => d.dateStr === overId);
        if (!targetDay) return;
        const targetEntry = entriesByDate[overId];

        if (active.id.startsWith('day:')) {
            const sourceDateStr = active.id.slice(4);
            if (sourceDateStr === overId) return;
            const sourceEntry = entriesByDate[sourceDateStr];
            if (!sourceEntry?.mealName) return;
            const sourceDay = days.find(d => d.dateStr === sourceDateStr);
            handleSave(overId, targetDay.dayName, sourceEntry.mealName);
            if (sourceDay) handleSave(sourceDateStr, sourceDay.dayName, targetEntry?.mealName || '');
        } else {
            const mealName = active.id;
            if (targetEntry?.mealName && targetEntry.mealName !== mealName) {
                setCandidates(prev => prev.includes(targetEntry.mealName) ? prev : [...prev, targetEntry.mealName]);
            }
            handleSave(overId, targetDay.dayName, mealName);
            setCandidates(prev => prev.filter(c => c !== mealName));
        }
    };

    const handleSuggestions = (suggestions) => {
        Object.entries(suggestions).forEach(([dateStr, mealName]) => {
            const day = days.find(d => d.dateStr === dateStr);
            if (day) handleSave(dateStr, day.dayName, mealName);
        });
    };

    return (
        <>
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
        >
        <DragOverlay dropAnimation={null}>
            {activeId ? (() => {
                const label = activeId.startsWith('day:')
                    ? entriesByDate[activeId.slice(4)]?.mealName
                    : activeId;
                return label ? (
                    <Tag size="md" colorScheme="purple" borderRadius="full" shadow="lg" cursor="grabbing" px={3} py={1}>
                        <TagLabel>{label}</TagLabel>
                    </Tag>
                ) : null;
            })() : null}
        </DragOverlay>
        <div>
            <SuggestPanel
                weekStart={weekStart}
                weather={weather}
                entries={entries}
                toDateStr={toDateStr}
                onSuggestions={handleSuggestions}
            />
            {AI_ENABLED && (
                <WeekHelper
                    weekStart={weekStart}
                    weather={weather}
                    entries={entries}
                    toDateStr={toDateStr}
                    onSuggestions={handleSuggestions}
                />
            )}
            <CandidateTray
                candidates={candidates}
                setCandidates={setCandidates}
                mealSuggestions={mealSuggestions}
            />
            {days.map(({ date, dateStr, dayName }) => (
                <DayRow
                    key={dateStr}
                    date={date}
                    dateStr={dateStr}
                    dayName={dayName}
                    entry={entriesByDate[dateStr]}
                    weather={weather[dateStr]}
                    mealSuggestions={mealSuggestions}
                    mealLibrary={mealLibrary}
                    onSave={handleSave}
                    onToggleConfirmed={handleToggleConfirmed}
                    onOpenDetail={(mode) => setDetailDay({ dateStr, dayName, entry: entriesByDate[dateStr], mode })}
                    onOpenAiChat={() => {
                        const existingMeals = {};
                        entries.forEach(e => { if (e.mealName) existingMeals[e.mealDate] = e.mealName; });
                        setAiChatDay({ dateStr, dayName, weather: weather[dateStr], existingMeals });
                    }}
                />
            ))}
            <Text fontSize="xs" color="gray.400" mt={2}>
                * Weather is approximate and for meal planning purposes only.
            </Text>
            <HStack justify="flex-end" mt={3} spacing={2}>
                <Button size="xs" variant="ghost" colorScheme="green" onClick={onAddMealOpen}>
                    + Add to meal library
                </Button>
                <Button size="xs" variant="ghost" colorScheme="gray" onClick={handlePrint}>
                    Print week
                </Button>
                {entries.some(e => days.some(d => d.dateStr === e.mealDate)) && (
                    <Button size="xs" variant="ghost" colorScheme="red" onClick={onAlertOpen}>
                        Clear this week
                    </Button>
                )}
            </HStack>
        </div>
        </DndContext>
        <AddMealModal
            isOpen={isAddMealOpen}
            onClose={onAddMealClose}
            onAdded={(saved) => {
                if (saved.name && !mealLibrary.some(m => m.name === saved.name)) {
                    setMealLibrary(prev => [...prev, { id: saved.id, name: saved.name, recipeLink: saved.recipeLink ?? null, notes: saved.notes ?? null, minTemp: saved.minTemp ?? null, maxTemp: saved.maxTemp ?? null, seasons: saved.seasons || [] }]
                        .sort((a, b) => a.name.localeCompare(b.name)));
                }
            }}
        />
        <AlertDialog isOpen={isAlertOpen} leastDestructiveRef={cancelRef} onClose={onAlertClose}>
            <AlertDialogOverlay>
                <AlertDialogContent>
                    <AlertDialogHeader fontSize="md" fontWeight="bold">Clear this week?</AlertDialogHeader>
                    <AlertDialogBody fontSize="sm">
                        This will remove all meals planned for this week. This cannot be undone.
                    </AlertDialogBody>
                    <AlertDialogFooter>
                        <Button ref={cancelRef} size="sm" onClick={onAlertClose}>Cancel</Button>
                        <Button colorScheme="red" size="sm" onClick={handleClearWeek} ml={3}>Clear week</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialogOverlay>
        </AlertDialog>
        {AI_ENABLED && aiChatDay && (() => {
            const season = getSeason(aiChatDay.dateStr);
            const seasonMeals = mealLibrary
                .filter(m => !m.seasons || m.seasons.length === 0 || m.seasons.includes(season))
                .map(m => m.name)
                .sort();
            return (
                <AiChatModal
                    isOpen={!!aiChatDay}
                    onClose={() => setAiChatDay(null)}
                    dateStr={aiChatDay.dateStr}
                    dayName={aiChatDay.dayName}
                    weather={aiChatDay.weather}
                    existingMeals={aiChatDay.existingMeals}
                    mealLibrary={seasonMeals}
                    weekStart={toDateStr(weekStart)}
                    onSelect={(mealName) => {
                        handleSave(aiChatDay.dateStr, aiChatDay.dayName, mealName);
                    }}
                />
            );
        })()}
        {detailDay && (
            <MealDetailModal
                isOpen={!!detailDay}
                onClose={() => setDetailDay(null)}
                dateStr={detailDay.dateStr}
                dayName={detailDay.dayName}
                entry={detailDay.entry}
                mode={detailDay.mode}
                onSaved={(saved) => {
                    setEntries(prev => {
                        const exists = prev.find(e => e.id === saved.id);
                        return exists
                            ? prev.map(e => e.id === saved.id ? saved : e)
                            : [...prev, saved];
                    });
                    if (saved.mealName && !mealLibrary.some(m => m.name === saved.mealName)) {
                        setMealLibrary(prev => [...prev, { id: saved.mealId, name: saved.mealName, recipeLink: saved.recipeLink ?? null, notes: saved.notes ?? null, minTemp: saved.minTemp ?? null, maxTemp: saved.maxTemp ?? null, seasons: saved.seasons || [] }]
                            .sort((a, b) => a.name.localeCompare(b.name)));
                    } else if (saved.mealName) {
                        setMealLibrary(prev => prev.map(m => m.name === saved.mealName
                            ? { ...m, recipeLink: saved.recipeLink ?? null, notes: saved.notes ?? null, minTemp: saved.minTemp ?? null, maxTemp: saved.maxTemp ?? null, seasons: saved.seasons || [] }
                            : m));
                    }
                }}
            />
        )}
        </>
    );
}

export default WeekPlanner;
