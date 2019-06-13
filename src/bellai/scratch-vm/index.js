import VM from 'scratch-vm';

// Add customized block primitives
import Scratch3BellMock from './blocks/scratch3-bell-mock';


const defaultBlockPackages = {
  bell_mock: Scratch3BellMock,
};

const registerBlockPackages = (vm, packages) => {
  for (const packageName in packages) {
    if (!packages.hasOwnProperty(packageName)) continue;

    const packageObject = new (packages[packageName])(vm);

    if (packageObject.getPrimitives) {
      const packagePrimitives = packageObject.getPrimitives();
      for (const op in packagePrimitives) {
        if (!packagePrimitives.hasOwnProperty(op)) continue;

        vm.runtime._primitives[op] = packagePrimitives[op].bind(packageObject);
      }
    }

    if (packageObject.getHats) {
      const packageHats = packageObject.getHats();
      for (const hatName in packageHats) {
        if (!pacakageHats.hasOwnProperty(hatName)) continue;

        vm.runtime_hats[hatName] = packageHats[hatName];
      }
    }

    if (packageObject.getMonitored) {
      vm.runtime.monitorBlockInfo = Object.assign({}, vm.runtime.monitorBlockInfo,
        packageObject.getMonitored());
    }
  }
};

const vm = new VM();
registerBlockPackages(vm, defaultBlockPackages);
global.vm = vm;

export default vm;
