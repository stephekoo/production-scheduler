# Maintenance Windows Prompts

## The Challenge

**Prompt:** How to handle maintenance windows that block work center availability?

Maintenance windows are:
- Fixed time periods when work center is unavailable
- Cannot be moved or rescheduled
- Work must pause during maintenance and resume after

## Solution

Maintenance windows treated similarly to non-shift hours:

```typescript
function isInMaintenanceWindow(date, windows) {
  return windows.some(w =>
    date >= parseDate(w.startDate) &&
    date < parseDate(w.endDate)
  );
}

function getNextAvailableTime(date, shifts, maintenanceWindows) {
  let current = date;

  while (true) {
    // Check shift availability
    const shift = getShiftForDay(current.weekday, shifts);
    if (!shift) {
      current = moveToNextDay(current);
      continue;
    }

    // Align to shift if before start
    if (current.hour < shift.startHour) {
      current = current.set({ hour: shift.startHour, minute: 0 });
    }

    // Check maintenance window
    const maintenance = maintenanceWindows.find(w =>
      current >= parseDate(w.startDate) &&
      current < parseDate(w.endDate)
    );

    if (maintenance) {
      // Skip to after maintenance
      current = parseDate(maintenance.endDate);
      continue;
    }

    // Check if still within shift
    if (current.hour >= shift.endHour) {
      current = moveToNextDay(current);
      continue;
    }

    return current;
  }
}
```

## Integration with End Date Calculation

The `calculateEndDateWithShiftsAndMaintenance` function:
1. Uses same loop as shift calculation
2. Additional check for maintenance windows
3. If current time falls in maintenance, skip to end of window
4. Continue counting remaining work time after maintenance
