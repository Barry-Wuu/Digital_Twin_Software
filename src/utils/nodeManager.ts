type DeviceValue = {
  [valueKey: string]: any;
};
type UpdateHandler = (uuid: string) => void;
class NodeManager {
  // 存储结构：Map<UUID, Map<NodePath>>
  private dataMap = new Map<string, Map<string, Record<string, any>>>();
  private updateListeners = new Set<UpdateHandler>();
  // 更新节点值（自动拆分路径）
  update(uuid: string, rawPath: string, value: any) {
    const [nodePath, valueKey] = this.parsePath(rawPath);
    if (!this.dataMap.has(uuid)) {
      this.dataMap.set(uuid, new Map());
    }
    const deviceMap = this.dataMap.get(uuid)!;
    const currentValue = deviceMap.get(nodePath) || {};
    if (currentValue[valueKey] === value) return;
    deviceMap.set(nodePath, {
      ...currentValue,
      [valueKey]: value,
    });
    this.notifyUpdate(uuid);
    console.log('更新后数据:', deviceMap.get(nodePath));
  }
  // 解析路径  24461a2c.../AAS/Capability/Input:value@Value → [AAS/Capability/Input, Input:value@Value]
  private parsePath(rawPath: string): [string, string] {
    // 强制规范路径：替换非法分隔符并标准化结构
    const normalizedPath = rawPath
      .replace(/\\/g, '/')          // 反斜杠转正斜杠
      .replace(/\/+/g, '/')         // 去除重复斜杠
      .replace(/(:\w+)@/g, '_@');   // 处理属性符（如 :value@ → _@value）
    // 分离路径段和属性段（最后两部分）
    const segments = normalizedPath.split('/');
    if (segments.length < 2) return [normalizedPath, 'value']; // 最低保障
    // 提取属性段（最后一段）
    const propSegment = segments.pop()!;
    // 组合有效路径段
    const nodePath = segments.join('/');
    return [nodePath, propSegment];
  }
  private notifyUpdate(uuid: string) {
    for (const handler of this.updateListeners) {
      handler(uuid);
    }
  }
  subscribe(handler: UpdateHandler) {
    this.updateListeners.add(handler);
    // 返回取消订阅函数
    return () => this.updateListeners.delete(handler);
  }
  public getSnapshot(): Array<[string, Map<string, DeviceValue>]> {
    return Array.from(this.dataMap).map(([uuid, paths]) => [
      uuid,
      new Map(Array.from(paths).map(([path, value]) => [path, { ...value }]))
    ]);
  }
  public getDeviceSnapshot(uuid: string) {
    const device = this.dataMap.get(uuid);
    return device ? Array.from(device.entries()) : [];
  }
  public getDeviceData(uuid: string): Map<string, Record<string, any>> | undefined {
    return this.dataMap.get(uuid);
  }
}
export const nodeManager = new NodeManager();