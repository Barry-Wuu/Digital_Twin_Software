import { create, IK } from 'kinematics-js';

// 根据 DAE 解析的 D-H 参数配置
interface DHParameters {
  a: number;
  d: number;
  alpha: number;
  theta: number;
  min?: number;
  max?: number;
}

export class ArmKinematics {
  private ik: IK;
  private jointLimits: Array<{ min: number; max: number }> = [];

  constructor(private dhParams: DHParameters[]) {
    // 初始化运动学链
    this.ik = create();
    this.dhParams.forEach((params, i) => {
      this.ik.addJoint({
        type: 'revolute',
        d: params.d,
        a: params.a,
        alpha: params.alpha,
        theta: params.theta,
        limits: { 
          min: params.min ?? -Math.PI, 
          max: params.max ?? Math.PI 
        }
      });
      this.jointLimits.push({ min: params.min ?? -Math.PI, max: params.max ?? Math.PI });
    });
  }

  /**
   * 计算从当前位置到达目标末端坐标的关节角度
   * @param targetPos [x, y, z] 目标坐标
   * @param currentAngles 当前各关节角度（弧度）
   * @returns 各关节角度数组（弧度），null 表示无解
   */
  solveIK(targetPos: number[], currentAngles: number[]): number[] | null {
    // 设置当前状态为初始猜测
    this.ik.set(currentAngles);

    // 求解逆向运动学（牛顿-拉夫森迭代法）
    const result = this.ik.solve(targetPos, {
      maxIterations: 1000,
      tolerance: 1e-4,
    });

    if (!result.converged) return null;

    // 应用关节限位约束
    return result.angles.map((angle, i) => {
      return Math.max(
        this.jointLimits[i].min,
        Math.min(this.jointLimits[i].max, angle)
      );
    });
  }
}

// D-H 参数配置
export const UR5_DH_PARAMS: DHParameters[] = [
  { a: 0, d: 0.089159, alpha: Math.PI/2, theta: 0, min: -Math.PI, max: Math.PI },
  { a: -0.425, d: 0, alpha: 0, theta: 0, min: -Math.PI/2, max: Math.PI/2 },
  { a: -0.39225, d: 0, alpha: 0, theta: 0, min: -Math.PI/2, max: Math.PI/2 },
  { a: 0, d: 0.10915, alpha: Math.PI/2, theta: 0, min: -Math.PI, max: Math.PI },
  { a: 0, d: 0.09465, alpha: -Math.PI/2, theta: 0, min: -Math.PI, max: Math.PI },
  { a: 0, d: 0.0823, alpha: 0, theta: 0, min: -Math.PI, max: Math.PI },
];
// 关节	α (弧度)	a (米)	d (米)	θ (变量/固定)	限位范围 (°)
// J1	  0	        0.15	  0.4865	θ₁ (变量)	[-180°, 180°]
// J2	  -π/2	   0.425	   0	    θ₂ (变量)	[-63°, 110°] 
// J3	  0	       0.475	   0	    θ₃ (变量)	[-235°, 55°]
// J4	 -π/2	     0	       0.6	  θ₄ (变量)	[-200°, 200°]
// J5	  π/2	    0.065     	0	    θ₅ (变量)	[-115°, 115°]
// J6	  0	        0	      0.098	  θ₆ (变量)	[-400°, 400°]



//4robot 数据
// 物体       轴一    轴二    （相对于底座中心点）
// 底座     (0.0345,0,0.04988)
// 臂一     (0.0345,0,0.04988)  (0.3345,0,0.242)