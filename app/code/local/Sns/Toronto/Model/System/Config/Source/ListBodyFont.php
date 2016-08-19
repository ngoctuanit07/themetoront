<?php
class Sns_Toronto_Model_System_Config_Source_ListBodyFont
{
	public function toOptionArray()
	{
		return array(
			array('value'=>'arial', 'label'=>Mage::helper('toronto')->__('Arial')),
			array('value'=>'arial-black', 'label'=>Mage::helper('toronto')->__('Arial black')),
			array('value'=>'courier new', 'label'=>Mage::helper('toronto')->__('courier New')),
			array('value'=>'georgia', 'label'=>Mage::helper('toronto')->__('Georgia')),
			array('value'=>'impact', 'label'=>Mage::helper('toronto')->__('Impact')),
			array('value'=>'lucida-console', 'label'=>Mage::helper('toronto')->__('Lucida Console')),
			array('value'=>'lucida-grande', 'label'=>Mage::helper('toronto')->__('Lucida-grande')),
			array('value'=>'palatino', 'label'=>Mage::helper('toronto')->__('Palatino')),
			array('value'=>'tahoma', 'label'=>Mage::helper('toronto')->__('Tahoma')),
			array('value'=>'times new roman', 'label'=>Mage::helper('toronto')->__('Times')),
			array('value'=>'Trebuchet', 'label'=>Mage::helper('toronto')->__('Trebuchet')),
			array('value'=>'Verdana', 'label'=>Mage::helper('toronto')->__('Verdana')),
			array('value'=>'segoe ui', 'label'=>Mage::helper('toronto')->__('Segoe UI'))
		);
	}
}
