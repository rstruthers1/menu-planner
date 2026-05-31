import { useRef, useState } from 'react';
import {
    AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
    AlertDialogHeader, AlertDialogOverlay, Button, HStack, useDisclosure,
} from '@chakra-ui/react';
import AddMealModal from './AddMealModal';
import AiChatModal from './AiChatModal';
import DayRow from './DayRow';
import MealDetailModal from './MealDetailModal';
import WeekHelper from './WeekHelper';
import { authFetch } from '../utils/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function WeekPlanner({ weekStart, entries, setEntries, weather, mealSuggestions, setMealSuggestions, toDateStr }) {
    const [detailDay, setDetailDay] = useState(null);
    const [aiChatDay, setAiChatDay] = useState(null);
    const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();
    const { isOpen: isAddMealOpen, onOpen: onAddMealOpen, onClose: onAddMealClose } = useDisclosure();
    const cancelRef = useRef();

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

        const body = {
            mealDate: dateStr,
            dayOfWeek: dayName,
            mealName: mealName.trim(),
            confirmed: existing?.confirmed ?? false,
            leftover: existing?.leftover ?? false,
            leftoverFromDate: existing?.leftoverFromDate ?? null,
        };

        const addSuggestion = (name) => {
            if (!mealSuggestions.includes(name)) {
                setMealSuggestions(prev => [...prev, name].sort());
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
                    addSuggestion(updated.mealName);
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
                    addSuggestion(created.mealName);
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
            const weatherStr = w
                ? `${icon(w.condition)} ${w.condition || ''} ${w.high !== undefined ? `${w.high}°/${w.low}°` : ''}`.trim()
                : '—';
            return `<tr>
                <td><strong>${dayName}</strong><br><span style="color:#888;font-size:11px">${dateLabel}</span></td>
                <td>${meal}${leftoverNote}${confirmed}</td>
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

    const handleSuggestions = (suggestions) => {
        Object.entries(suggestions).forEach(([dateStr, mealName]) => {
            const day = days.find(d => d.dateStr === dateStr);
            if (day) handleSave(dateStr, day.dayName, mealName);
        });
    };

    return (
        <>
        <div>
            <WeekHelper
                weekStart={weekStart}
                weather={weather}
                entries={entries}
                toDateStr={toDateStr}
                onSuggestions={handleSuggestions}
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
        <AddMealModal
            isOpen={isAddMealOpen}
            onClose={onAddMealClose}
            onAdded={(saved) => {
                if (saved.name && !mealSuggestions.includes(saved.name)) {
                    setMealSuggestions(prev => [...prev, saved.name].sort());
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
        {aiChatDay && (
            <AiChatModal
                isOpen={!!aiChatDay}
                onClose={() => setAiChatDay(null)}
                dateStr={aiChatDay.dateStr}
                dayName={aiChatDay.dayName}
                weather={aiChatDay.weather}
                existingMeals={aiChatDay.existingMeals}
                mealLibrary={mealSuggestions}
                weekStart={toDateStr(weekStart)}
                onSelect={(mealName) => {
                    handleSave(aiChatDay.dateStr, aiChatDay.dayName, mealName);
                    if (!mealSuggestions.includes(mealName)) {
                        setMealSuggestions(prev => [...prev, mealName].sort());
                    }
                }}
            />
        )}
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
                    if (saved.mealName && !mealSuggestions.includes(saved.mealName)) {
                        setMealSuggestions(prev => [...prev, saved.mealName].sort());
                    }
                }}
            />
        )}
        </>
    );
}

export default WeekPlanner;
