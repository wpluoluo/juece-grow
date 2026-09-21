import * as migration_20260830_122948 from './20260830_122948';
import * as migration_20260919_093340_drop_lead_activity from './20260919_093340_drop_lead_activity';
import * as migration_20260920_121115_page_copy_collections from './20260920_121115_page_copy_collections';
import * as migration_20260920_195201_page_copy_project_unique_index from './20260920_195201_page_copy_project_unique_index';

export const migrations = [
  {
    up: migration_20260830_122948.up,
    down: migration_20260830_122948.down,
    name: '20260830_122948',
  },
  {
    up: migration_20260919_093340_drop_lead_activity.up,
    down: migration_20260919_093340_drop_lead_activity.down,
    name: '20260919_093340_drop_lead_activity',
  },
  {
    up: migration_20260920_121115_page_copy_collections.up,
    down: migration_20260920_121115_page_copy_collections.down,
    name: '20260920_121115_page_copy_collections',
  },
  {
    up: migration_20260920_195201_page_copy_project_unique_index.up,
    down: migration_20260920_195201_page_copy_project_unique_index.down,
    name: '20260920_195201_page_copy_project_unique_index'
  },
];
