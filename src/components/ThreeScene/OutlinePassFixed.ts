import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";

export class OutlinePassFixed extends OutlinePass {
	constructor(resolution, scene, camera){
		super(resolution, scene, camera);
	}
	
	changeVisibilityOfNonSelectedObjects( bVisible ) {
		const cache = this._visibilityCache;
		const selectedMeshes = [];
		function gatherSelectedMeshesCallBack( object ) {
			if ( object.isMesh ) selectedMeshes.push( object );
		}
		for ( let i = 0; i < this.selectedObjects.length; i ++ ) {
			const selectedObject = this.selectedObjects[ i ];
			selectedObject.traverse( gatherSelectedMeshesCallBack );
		}
		function VisibilityChangeCallBack( object ) {
			if ( object.isMesh || object.isSprite || object.isTransformControls ) {  // 更改的行
				let bFound = false;
				for ( let i = 0; i < selectedMeshes.length; i ++ ) {
					const selectedObjectId = selectedMeshes[ i ].id;
					if ( selectedObjectId === object.id ) {
						bFound = true;
						break;
					}
				}
				if ( bFound === false ) {
					const visibility = object.visible;
					if ( bVisible === false || cache.get( object ) === true ) {
						object.visible = bVisible;
					}
					cache.set( object, visibility );
				}
			} else if ( object.isPoints || object.isLine ) {
				if ( bVisible === true ) {
					object.visible = cache.get( object ); // restore
				} else {
					cache.set( object, object.visible );
					object.visible = bVisible;
				}
			}
		}
		this.renderScene.traverse( VisibilityChangeCallBack );
	}
}
