import { registerRoot } from "remotion";
import { makeRoot } from "./Root";
import { act1 } from "./shots/act1";
import { act2a } from "./shots/act2a";
import { act2b } from "./shots/act2b";
import { act3 } from "./shots/act3";
import { act4 } from "./shots/act4";
import { act5 } from "./shots/act5";

registerRoot(makeRoot([...act1, ...act2a, ...act2b, ...act3, ...act4, ...act5]));
