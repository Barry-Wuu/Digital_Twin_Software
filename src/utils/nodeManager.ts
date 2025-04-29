type DeviceValue = {
  [valueKey: string]: any;
};
class NodeManager {
  // 存储结构：Map<UUID, Map<NodePath>>
  private dataMap = new Map<string, Map<string, Record<string, any>>>();
  // private listeners = new Map<string, Map<string, Set<(val: any) => void>>>();
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
    // this.triggerListeners(uuid, nodePath);
    // console.log(`存储路径 => uuid:${uuid}, path:${nodePath}, key:${valueKey}`);
    console.log('更新后数据:', deviceMap.get(nodePath));
  }
  // 解析路径  24461a2c.../AAS/Capability/Input:value@Value → [AAS/Capability/Input, Input:value@Value]
  // private parsePath(rawPath: string): [string, string] {
  //   if (!rawPath || typeof rawPath !== 'string') {  // 前置校验
  //     return ['', ''];
  //   }
  //   // 优先尝试按/分割方式
  //   const parts = rawPath.split('/');
  //   if (parts.length < 1) {
  //     console.warn("空路径解析请求", rawPath);
  //     return ['', ''];
  //   }
  //   // 取出最后一个子路径作为属性名
  //   const lastSegment = parts.pop()!;  // 非空断言
  //   return [parts.join('/'), lastSegment];
  // }
  // private parsePath(rawPath: string): [string, string] {
  //   // 新路径拆分逻辑（支持带@Value和不带的情况）
  //   const pathRegex = /(.+\/)?([^/]+@Value)$/; 
  //   if (!pathRegex.test(rawPath)) {
  //     console.warn("非法路径格式:", rawPath);
  //     return [rawPath, 'default']; // 确保基本路径保存
  //   }
  //   const [, pathPart, valuePart] = rawPath.match(pathRegex)!;
  //   return [pathPart?.replace(/\/$/, '') || rawPath, valuePart];
  // }
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