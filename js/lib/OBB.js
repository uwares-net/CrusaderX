// Filename: js/lib/OBB.js
/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://github.com/erich666
 * @author takahirox / https://github.com/takahirox
 */

// Renamed from Box3 to OBB
THREE.OBB = ( function () {

    var _vector = new THREE.Vector3();
    var _box = new THREE.Box3();

    function OBB( center, halfSize, rotation ) {

        this.center = ( center !== undefined ) ? center : new THREE.Vector3();
        this.halfSize = ( halfSize !== undefined ) ? halfSize : new THREE.Vector3();
        this.rotation = ( rotation !== undefined ) ? rotation : new THREE.Matrix3();

    }

    Object.assign( OBB.prototype, {

        set: function ( center, halfSize, rotation ) {

            this.center.copy( center );
            this.halfSize.copy( halfSize );
            this.rotation.copy( rotation );

            return this;

        },

        clone: function () {

            return new this.constructor().copy( this );

        },

        copy: function ( obb ) {

            this.center.copy( obb.center );
            this.halfSize.copy( obb.halfSize );
            this.rotation.copy( obb.rotation );

            return this;

        },

        /**
         * Rotates this OBB directly by applying the given rotation matrix.
         */
        applyMatrix4: function( matrix4 ) {

            var e = matrix4.elements;
            var r0 = this.rotation.elements;

            // Rotate center.
            this.center.applyMatrix4( matrix4 );

            // Rotate halfSize.
            var halfSize = _vector.copy( this.halfSize );
            this.halfSize.set(
                Math.abs(halfSize.x * e[0]) + Math.abs(halfSize.y * e[1]) + Math.abs(halfSize.z * e[2]),
                Math.abs(halfSize.x * e[4]) + Math.abs(halfSize.y * e[5]) + Math.abs(halfSize.z * e[6]),
                Math.abs(halfSize.x * e[8]) + Math.abs(halfSize.y * e[9]) + Math.abs(halfSize.z * e[10])
            );

            // Rotate axes.
            var r1 = new THREE.Matrix3().set(
                e[0], e[1], e[2],
                e[4], e[5], e[6],
                e[8], e[9], e[10]
            );

            this.rotation.set(
                r1.elements[0] * r0[0] + r1.elements[1] * r0[3] + r1.elements[2] * r0[6],
                r1.elements[0] * r0[1] + r1.elements[1] * r0[4] + r1.elements[2] * r0[7],
                r1.elements[0] * r0[2] + r1.elements[1] * r0[5] + r1.elements[2] * r0[8],

                r1.elements[3] * r0[0] + r1.elements[4] * r0[3] + r1.elements[5] * r0[6],
                r1.elements[3] * r0[1] + r1.elements[4] * r0[4] + r1.elements[5] * r0[7],
                r1.elements[3] * r0[2] + r1.elements[4] * r0[5] + r1.elements[5] * r0[8],

                r1.elements[6] * r0[0] + r1.elements[7] * r0[3] + r1.elements[8] * r0[6],
                r1.elements[6] * r0[1] + r1.elements[7] * r0[4] + r1.elements[8] * r0[7],
                r1.elements[6] * r0[2] + r1.elements[7] * r0[5] + r1.elements[8] * r0[8]
            );

            return this;

        },

        equals: function ( obb ) {

            return obb.center.equals( this.center ) &&
                obb.rotation.equals( this.rotation ) &&
                obb.halfSize.equals( this.halfSize );

        },

        /**
         * Returns a Box3 representing the axis-aligned bounding box of this OBB.
         */
        getBoundingBox: function() {
            var obb = this;
            var center = obb.center;
            var halfSize = obb.halfSize;
            var rotation = obb.rotation;
            var R = rotation.elements;
            var AbsR = [
                Math.abs(R[0]), Math.abs(R[1]), Math.abs(R[2]),
                Math.abs(R[3]), Math.abs(R[4]), Math.abs(R[5]),
                Math.abs(R[6]), Math.abs(R[7]), Math.abs(R[8]),
            ];

            // Compute the rotation extent ([AbsR][halfSize^T])^T.
            var extent = _vector.set(
                AbsR[0] * halfSize.x + AbsR[1] * halfSize.y + AbsR[2] * halfSize.z,
                AbsR[3] * halfSize.x + AbsR[4] * halfSize.y + AbsR[5] * halfSize.z,
                AbsR[6] * halfSize.x + AbsR[7] * halfSize.y + AbsR[8] * halfSize.z
            );

            _box.min.subVectors( center, extent );
            _box.max.addVectors( center, extent );

            return _box;
        },

        clampPoint: function ( point, result ) {
            var R = this.rotation.elements;

            _vector.subVectors( point, this.center );
            _vector.applyMatrix3( this.rotation ); // Bring point into OBB frame

            _vector.clamp(
                _vector.set(-this.halfSize.x, -this.halfSize.y, -this.halfSize.z),
                this.halfSize);

             // Rotate point back to world frame. Need to transpose rotation matrix.
             result.copy( _vector );
             result.x = R[0] * _vector.x + R[3] * _vector.y + R[6] * _vector.z;
             result.y = R[1] * _vector.x + R[4] * _vector.y + R[7] * _vector.z;
             result.z = R[2] * _vector.x + R[5] * _vector.y + R[8] * _vector.z;
             result.add( this.center );

             return result;
        },

        containsPoint: function ( point ) {

            var R = this.rotation.elements;

            _vector.subVectors( point, this.center );
            _vector.applyMatrix3( this.rotation ); // Bring point into OBB frame

            return Math.abs(_vector.x) <= this.halfSize.x &&
                Math.abs(_vector.y) <= this.halfSize.y &&
                Math.abs(_vector.z) <= this.halfSize.z;

        },

        intersectsBox3: function( box3 ) {

            return this.intersectsOBB( new OBB().fromBox3( box3 ) );

        },

        intersectsSphere: ( function () {

            var closestPoint = new THREE.Vector3();

            return function intersectsSphere( sphere ) {

                this.clampPoint( sphere.center, closestPoint );
                return closestPoint.distanceToSquared( sphere.center ) <= sphere.radius * sphere.radius;

            };

        } )(),

        intersectsOBB: ( function () {

            var axes = [
                new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
                new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
                new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
                new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
                new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
            ];
            var translation = new THREE.Vector3();
            var R0 = [], R1 = [], R = [];
            var AbsR = [[], [], []];
            var extentA = new THREE.Vector3();
            var extentB = new THREE.Vector3();
            var separation = new THREE.Vector3();

            /**
             * Returns the projection interval radius of this OBB onto the specified axis.
             *
             * @param {THREE.Vector3} axis The axis.
             * @return {number} The interval radius.
             */
            function computeProjectionRadius( obb, axis ) {
                var R = obb.rotation.elements;
                var AbsR = [
                    Math.abs(R[0]), Math.abs(R[1]), Math.abs(R[2]),
                    Math.abs(R[3]), Math.abs(R[4]), Math.abs(R[5]),
                    Math.abs(R[6]), Math.abs(R[7]), Math.abs(R[8]),
                ];
                var halfSize = obb.halfSize;
                return AbsR[0] * Math.abs(axis.x) + AbsR[3] * Math.abs(axis.y) + AbsR[6] * Math.abs(axis.z) +
                    AbsR[1] * Math.abs(axis.x) + AbsR[4] * Math.abs(axis.y) + AbsR[7] * Math.abs(axis.z) +
                    AbsR[2] * Math.abs(axis.x) + AbsR[5] * Math.abs(axis.y) + AbsR[8] * Math.abs(axis.z);
            }

            /**
             * Returns true if the specified OBB penetrates this OBB, false otherwise.
             *
             * @param {OBB} obb The OBB to test.
             * @return {boolean} True if the OBBs are intersecting, false otherwise.
             */
            return function intersectsOBB( obb, epsilon ) {
                if ( epsilon === undefined ) epsilon = Number.EPSILON;
                var obbA = this;
                var obbB = obb;

                // Extract rotation matrices.
                R0 = obbA.rotation.elements;
                R1 = obbB.rotation.elements;

                // Compute rotation matrix expressing OBB B frame in OBB A frame.
                R[0] = R0[0] * R1[0] + R0[3] * R1[1] + R0[6] * R1[2];
                R[1] = R0[0] * R1[3] + R0[3] * R1[4] + R0[6] * R1[5];
                R[2] = R0[0] * R1[6] + R0[3] * R1[7] + R0[6] * R1[8];

                R[3] = R0[1] * R1[0] + R0[4] * R1[1] + R0[7] * R1[2];
                R[4] = R0[1] * R1[3] + R0[4] * R1[4] + R0[7] * R1[5];
                R[5] = R0[1] * R1[6] + R0[4] * R1[7] + R0[7] * R1[8];

                R[6] = R0[2] * R1[0] + R0[5] * R1[1] + R0[8] * R1[2];
                R[7] = R0[2] * R1[3] + R0[5] * R1[4] + R0[8] * R1[5];
                R[8] = R0[2] * R1[6] + R0[5] * R1[7] + R0[8] * R1[8];

                // Compute absolute rotation matrix.
                AbsR[0][0] = Math.abs( R[0] ) + epsilon; AbsR[0][1] = Math.abs( R[1] ) + epsilon; AbsR[0][2] = Math.abs( R[2] ) + epsilon;
                AbsR[1][0] = Math.abs( R[3] ) + epsilon; AbsR[1][1] = Math.abs( R[4] ) + epsilon; AbsR[1][2] = Math.abs( R[5] ) + epsilon;
                AbsR[2][0] = Math.abs( R[6] ) + epsilon; AbsR[2][1] = Math.abs( R[7] ) + epsilon; AbsR[2][2] = Math.abs( R[8] ) + epsilon;

                // Compute translation vector T = Cb - Ca.
                translation.subVectors( obbB.center, obbA.center );
                // Translate T into OBB A frame.
                translation.set(
                    translation.x * R0[0] + translation.y * R0[1] + translation.z * R0[2],
                    translation.x * R0[3] + translation.y * R0[4] + translation.z * R0[5],
                    translation.x * R0[6] + translation.y * R0[7] + translation.z * R0[8]
                );

                extentA = obbA.halfSize;
                extentB = obbB.halfSize;

                // Test the 15 SEPARATING AXES

                // L = A0, A1, A2
                if( Math.abs( translation.x ) > extentA.x + extentB.x * AbsR[0][0] + extentB.y * AbsR[0][1] + extentB.z * AbsR[0][2] ) return false;
                if( Math.abs( translation.y ) > extentA.y + extentB.x * AbsR[1][0] + extentB.y * AbsR[1][1] + extentB.z * AbsR[1][2] ) return false;
                if( Math.abs( translation.z ) > extentA.z + extentB.x * AbsR[2][0] + extentB.y * AbsR[2][1] + extentB.z * AbsR[2][2] ) return false;

                // L = B0, B1, B2
                if( Math.abs( translation.x * R[0] + translation.y * R[3] + translation.z * R[6] ) > extentA.x * AbsR[0][0] + extentA.y * AbsR[1][0] + extentA.z * AbsR[2][0] + extentB.x ) return false;
                if( Math.abs( translation.x * R[1] + translation.y * R[4] + translation.z * R[7] ) > extentA.x * AbsR[0][1] + extentA.y * AbsR[1][1] + extentA.z * AbsR[2][1] + extentB.y ) return false;
                if( Math.abs( translation.x * R[2] + translation.y * R[5] + translation.z * R[8] ) > extentA.x * AbsR[0][2] + extentA.y * AbsR[1][2] + extentA.z * AbsR[2][2] + extentB.z ) return false;

                // L = A0 x B0
                separation = Math.abs( translation.y * R[6] - translation.z * R[3] );
                if( separation > extentA.y * AbsR[2][0] + extentA.z * AbsR[1][0] + extentB.y * AbsR[0][2] + extentB.z * AbsR[0][1] ) return false;

                // L = A0 x B1
                separation = Math.abs( translation.y * R[7] - translation.z * R[4] );
                if( separation > extentA.y * AbsR[2][1] + extentA.z * AbsR[1][1] + extentB.x * AbsR[0][2] + extentB.z * AbsR[0][0] ) return false;

                // L = A0 x B2
                separation = Math.abs( translation.y * R[8] - translation.z * R[5] );
                if( separation > extentA.y * AbsR[2][2] + extentA.z * AbsR[1][2] + extentB.x * AbsR[0][1] + extentB.y * AbsR[0][0] ) return false;

                // L = A1 x B0
                separation = Math.abs( translation.x * R[6] - translation.z * R[0] );
                if( separation > extentA.x * AbsR[2][0] + extentA.z * AbsR[0][0] + extentB.y * AbsR[1][2] + extentB.z * AbsR[1][1] ) return false;

                // L = A1 x B1
                separation = Math.abs( translation.x * R[7] - translation.z * R[1] );
                if( separation > extentA.x * AbsR[2][1] + extentA.z * AbsR[0][1] + extentB.x * AbsR[1][2] + extentB.z * AbsR[1][0] ) return false;

                // L = A1 x B2
                separation = Math.abs( translation.x * R[8] - translation.z * R[2] );
                if( separation > extentA.x * AbsR[2][2] + extentA.z * AbsR[0][2] + extentB.x * AbsR[1][1] + extentB.y * AbsR[1][0] ) return false;

                // L = A2 x B0
                separation = Math.abs( translation.x * R[3] - translation.y * R[0] );
                if( separation > extentA.x * AbsR[1][0] + extentA.y * AbsR[0][0] + extentB.y * AbsR[2][2] + extentB.z * AbsR[2][1] ) return false;

                // L = A2 x B1
                separation = Math.abs( translation.x * R[4] - translation.y * R[1] );
                if( separation > extentA.x * AbsR[1][1] + extentA.y * AbsR[0][1] + extentB.x * AbsR[2][2] + extentB.z * AbsR[2][0] ) return false;

                // L = A2 x B2
                separation = Math.abs( translation.x * R[5] - translation.y * R[2] );
                if( separation > extentA.x * AbsR[1][2] + extentA.y * AbsR[0][2] + extentB.x * AbsR[2][1] + extentB.y * AbsR[2][0] ) return false;

                // Since no separating axis is found, the OBBs must be intersecting.
                return true;

            };

        } )(),

        fromBox3: function( box3 ) {

            this.center.addVectors( box3.min, box3.max ).multiplyScalar( 0.5 );
            this.halfSize.subVectors( box3.max, box3.min ).multiplyScalar( 0.5 );
            this.rotation.identity();

            return this;

        },

    } );

    return OBB;

} )();