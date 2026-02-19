import {
  GET_PRICING_REQUEST,
  GET_PRICING_SUCCESS,
  GET_PRICING_FAILURE,
} from "@src/redux/actions/pricing";

const initialState = {
  items: [],
  content: null as any,
  loading: false,
  error: null as string | null,
};

export default function pricing(state = initialState, action: any) {
  switch (action.type) {
    case GET_PRICING_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_PRICING_SUCCESS: {
      const payload = action.payload;
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      const content = Array.isArray(payload) ? state.content : payload?.content ?? null;
      return { ...state, loading: false, items, content };
    }
    case GET_PRICING_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
