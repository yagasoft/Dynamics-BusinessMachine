(function (global) {
  const DBM = (global.DBM = global.DBM || {});
  function getFormContext(executionContext) {
    if (!executionContext) {
      return null;
    }
    if (typeof executionContext.getFormContext === 'function') {
      return executionContext.getFormContext();
    }
    return executionContext;
  }
  function getTab(formContext, tabName) {
    return formContext?.ui?.tabs?.get ? formContext.ui.tabs.get(tabName) : null;
  }
  function getSection(formContext, tabName, sectionName) {
    const tab = getTab(formContext, tabName);
    return tab?.sections?.get ? tab.sections.get(sectionName) : null;
  }
  function getControl(formContext, controlName) {
    return formContext?.getControl ? formContext.getControl(controlName) : null;
  }
  function setRequiredLevel(control, isRequired) {
    if (typeof control?.getAttribute !== "function") {
      return;
    }
    const attribute = control.getAttribute();
    if (!attribute || typeof attribute.setRequiredLevel !== "function") {
      return;
    }
    attribute.setRequiredLevel(isRequired ? "required" : "none");
  }
  function applyState(executionContext, config, activeStateId) {
    const formContext = getFormContext(executionContext);
    if (!formContext || !config) {
      return;
    }
    const states = config.states || [];
    const activeState = states.find((entry) => entry.id === activeStateId) || states[0] || null;
    const visibleControls = new Set(activeState?.visibleControlNames || []);
    const requiredControls = new Set(activeState?.requiredControlNames || []);
    const lockedControls = new Set(activeState?.lockedControlNames || []);
    (config.sections || []).forEach((sectionConfig) => {
      const section = getSection(formContext, sectionConfig.tabName, sectionConfig.sectionName);
      const tab = getTab(formContext, sectionConfig.tabName);
      const hasVisibleControl = (sectionConfig.controls || []).some((control) => visibleControls.has(control.controlName));
      if (section && typeof section.setVisible === "function") {
        section.setVisible(hasVisibleControl);
      }
      if (tab && typeof tab.setVisible === "function") {
        const tabHasVisibleControl = (config.sections || []).some((candidateSection) =>
          candidateSection.tabName === sectionConfig.tabName &&
          (candidateSection.controls || []).some((candidateControl) => visibleControls.has(candidateControl.controlName))
        );
        tab.setVisible(tabHasVisibleControl);
      }
      (sectionConfig.controls || []).forEach((controlConfig) => {
        const control = getControl(formContext, controlConfig.controlName);
        if (!control) {
          return;
        }
        const shouldBeVisible = visibleControls.has(controlConfig.controlName);
        if (typeof control.setVisible === "function") {
          control.setVisible(shouldBeVisible);
        }
        if (!shouldBeVisible) {
          setRequiredLevel(control, false);
          return;
        }
        if (typeof control.setDisabled === "function") {
          control.setDisabled(Boolean(controlConfig.readOnly) || lockedControls.has(controlConfig.controlName));
        }
        setRequiredLevel(control, requiredControls.has(controlConfig.controlName));
      });
    });
  }
  DBM.FormBehavior = {
    apply: applyState
  };
})(window);
