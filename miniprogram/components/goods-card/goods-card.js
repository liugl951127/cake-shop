Component({
  properties: {
    item: { type: Object, value: {} }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', this.data.item);
    }
  }
});
