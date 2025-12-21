import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isMenuOpen: false,
  activeAboutCard: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleMenu(state) {
      state.isMenuOpen = !state.isMenuOpen;
    },
    closeMenu(state) {
      state.isMenuOpen = false;
    },
    openAboutCard(state, action) {
      state.activeAboutCard = action.payload;
    },
    closeAboutCard(state) {
      state.activeAboutCard = null;
    },
  },
});

export const { toggleMenu, closeMenu, openAboutCard, closeAboutCard } = uiSlice.actions;
export default uiSlice.reducer;
