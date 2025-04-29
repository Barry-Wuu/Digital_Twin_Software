//拓展collada数据类型
import * as THREE from 'three';

declare module 'three/examples/jsm/loaders/ColladaLoader' {
  interface ColladaModel {
    dae: {
      library_kinematics_models?: {
        kinematics_model: KinematicsModel[];
      };
      library_articulated_systems?: {
        articulated_system: ArticulatedSystem[];
      };
      library_joints?: {
        joint: Joint[];
      };
    };
    scene: THREE.Scene;
  }

  interface KinematicsModel {
    instance_articulated_system: {
      url: string;
    };
  }

  interface ArticulatedSystem {
    id: string;
    instance_joint: {
      url: string;
      bind?: {
        axis: string;
      }; 
    }[];
  }

  interface Joint {
    id: string;
    type: 'revolute' | 'prismatic';
    axis: { 
      $: { 
        x: string; 
        y: string; 
        z: string; 
      } 
    }; 
    limits?: {
      $: {
        lower: string; 
        upper: string; 
      }
    };
  }
}

