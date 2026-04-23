import React, { useState, useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import CheckinForm from './CheckinForm';
import { isSameDay } from 'date-fns';

interface EntryFormProps {
    onManageTrackers?: () => void;
}

const EntryForm: React.FC<EntryFormProps> = ({ onManageTrackers }) => {
    const { entries } = useTrackers();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Filter existing entries for the selected date
    const existingEntries = useMemo(() => {
        return entries.filter(e => isSameDay(new Date(e.timestamp), selectedDate));
    }, [entries, selectedDate]);

    return (
        <div className="bg-slate-50/50 -mx-4 -mt-2 p-4 min-h-[60vh] sm:rounded-xl sm:mx-0 sm:mt-0 sm:border border-slate-100">
            <div className="max-w-lg mx-auto">
                <CheckinForm 
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    showProtocols={false}
                    showDatePicker={true}
                    existingEntries={existingEntries}
                    onManageTrackers={onManageTrackers}
                />
            </div>
        </div>
    );
};

export default EntryForm;
