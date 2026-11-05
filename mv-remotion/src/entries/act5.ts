// 막 하나만 묶는 진입점. 다른 막 파일이 고치는 중이어도 이 막의 미리보기는 깨지지 않는다.
import { registerRoot } from "remotion";
import { makeRoot } from "../Root";
import { act5 } from "../shots/act5";

registerRoot(makeRoot(act5));
