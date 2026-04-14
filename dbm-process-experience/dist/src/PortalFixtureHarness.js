import { jsx as _jsx } from "react/jsx-runtime";
import { ProcessExperienceSurface } from './ProcessExperienceSurface';
export function PortalFixtureHarness({ snapshot }) {
    return (_jsx("div", { style: fixtureShellStyle, children: _jsx(ProcessExperienceSurface, { snapshot: snapshot, audience: "portal", mode: "portal-fixture" }) }));
}
const fixtureShellStyle = {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem'
};
