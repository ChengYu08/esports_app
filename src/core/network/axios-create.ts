import { create as axiosCreate } from "axios";

/** 包装 axios.create，避免 eslint no-named-as-default-member 警告。 */
export { axiosCreate };
