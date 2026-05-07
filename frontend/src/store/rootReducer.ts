import { combineReducers } from '@reduxjs/toolkit';
import jobsReducer from './slices/jobs.slice';

const rootReducer = combineReducers({
  jobs: jobsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;