import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['uploadExtraction/addFiles'],
        ignoredPaths: ['uploadExtraction.files'],
      },
    }),
});

export type AppDispatch = typeof store.dispatch;