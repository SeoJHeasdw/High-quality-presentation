import { Component, createRef, type ReactNode } from "react";
import { CourseMotionController, type MotionSnapshot } from "./course-motion";

type Props = { cue: string; children: ReactNode };

/** Snapshot before React mutates the existing scene so plain text swaps also receive default motion. */
export default class CourseMotionBoundary extends Component<Props, {}, MotionSnapshot | null> {
  private element = createRef<HTMLDivElement>();
  private controller: CourseMotionController;

  componentDidMount() {
    this.controller = new CourseMotionController(this.element.current);
    this.controller.mount(this.props.cue);
  }

  getSnapshotBeforeUpdate(previous: Props) {
    return previous.cue !== this.props.cue ? this.controller.before() : null;
  }

  componentDidUpdate(_previous: Props, _state: {}, snapshot: MotionSnapshot | null) {
    if (snapshot) this.controller.after(snapshot, this.props.cue);
  }

  componentWillUnmount() { this.controller?.cancel(); }

  render() {
    return <div ref={this.element} className="slide-enter" style={{ position: "absolute", inset: 0 }}>{this.props.children}</div>;
  }
}
