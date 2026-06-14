Component({
  properties: {
    value: { type: Number, value: 0 },
    duration: { type: Number, value: 800 },
    decimals: { type: Number, value: 0 }
  },
  data: { display: 0, bump: false },
  observers: {
    'value': function (newVal) {
      if (typeof newVal !== 'number') return;
      const start = this.data.display;
      const end = newVal;
      const startTime = Date.now();
      const tick = () => {
        const now = Date.now();
        const t = Math.min(1, (now - startTime) / this.data.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = start + (end - start) * eased;
        this.setData({
          display: Number(current.toFixed(this.data.decimals)),
          bump: t < 1 ? this.data.bump : true
        });
        if (t < 1) requestAnimationFrame(tick);
      };
      tick();
    }
  }
});
