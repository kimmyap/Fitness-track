/**
 * Train page: Lower A / Upper / Lower B / Warm-up / Core as segmented tabs.
 *
 * Deep-linkable via the `tab` search param (e.g. /train?tab=lower-a) because
 * the router currently maps only the exact `/train` path to this page — see
 * trainTabs.ts. The "Logging for" date is shared across the three workout
 * tabs (legacy logDate behavior).
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { useSearchParams } from 'react-router';
import { PageHeader, SegmentedTabs } from '@/components';
import { isoDate } from '@/lib/domain';
import { DEFAULT_TRAIN_TAB, TRAIN_TABS, isTrainTabId } from './trainTabs';
import { WorkoutDayView } from './WorkoutDayView';
import { WarmupTab } from './WarmupTab';
import { CoreTab } from './CoreTab';

const TabPanel = styled.div`
  margin-top: ${({ theme }) => theme.space[4]};
`;

/* 5 tabs don't fit at 375px — scroll the strip itself, never the page. */
const TabsScroller = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  > div {
    min-width: max-content;
  }
`;

export function TrainPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = isTrainTabId(tabParam) ? tabParam : DEFAULT_TRAIN_TAB;
  const todayIso = isoDate();
  const [logDate, setLogDate] = useState(todayIso);

  const activeDef = TRAIN_TABS.find((t) => t.id === tab);

  return (
    <>
      <PageHeader title="Train" subtitle="Bar fills as your top weight climbs toward your goal for that lift" />
      <TabsScroller>
        <SegmentedTabs
          aria-label="Training day"
          tabs={TRAIN_TABS.map(({ id, label }) => ({ id, label }))}
          value={tab}
          onChange={(id) => setSearchParams({ tab: id })}
        />
      </TabsScroller>
      <TabPanel role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {activeDef?.day ? (
          <WorkoutDayView day={activeDef.day} logDate={logDate} todayIso={todayIso} onLogDateChange={setLogDate} />
        ) : tab === 'warmup' ? (
          <WarmupTab />
        ) : (
          <CoreTab />
        )}
      </TabPanel>
    </>
  );
}

export default TrainPage;
